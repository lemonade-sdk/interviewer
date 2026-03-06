import OpenAI from 'openai';
import http from 'http';
import https from 'https';
import net from 'net';
import { InterviewerSettings, Message, ModelConfig } from '../types';
import axios from 'axios';
import { truncateConversationHistory } from '../utils/tokenUtils';
import { TextProcessingService } from './TextProcessingService';

/**
 * LemonadeClient - Integration with Lemonade Server
 * Lemonade Server is a local LLM server that implements the OpenAI API standard
 * Running at http://localhost:8000/api/v1
 * 
 * Documentation: https://lemonade-server.ai/docs/
 */
export class LemonadeClient {
  private settings: InterviewerSettings;
  private client!: OpenAI;
  private baseURL: string = 'http://localhost:8000/api/v1';
  private apiKey: string = 'lemonade'; // Required but unused by Lemonade Server
  private isConnected: boolean = false;
  private availableModels: ModelConfig[] = [];

  constructor(settings: InterviewerSettings, customBaseURL?: string) {
    this.settings = settings;
    if (customBaseURL) {
      this.baseURL = customBaseURL;
    }
    this.initializeClient();
  }

  private initializeClient(): void {
    // Initialize OpenAI client pointing to Lemonade Server
    this.client = new OpenAI({
      baseURL: this.baseURL,
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: false, // We're in Node.js (Electron main process)
    });

    console.log('Lemonade Server client initialized:', {
      baseURL: this.baseURL,
      model: this.settings.modelName,
    });
  }

  /**
   * Check if Lemonade Server is running and accessible
   */
  async checkServerHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
      });
      this.isConnected = response.status === 200;
      return this.isConnected;
    } catch (error) {
      this.isConnected = false;
      console.error('Lemonade Server health check failed:', error);
      return false;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Fetch available models from Lemonade Server
   */
  async fetchAvailableModels(): Promise<ModelConfig[]> {
    try {
      const response = await this.client.models.list();
      
      this.availableModels = response.data.map((model: any) => ({
        id: model.id,
        name: model.id, // Use model ID as name
        provider: 'lemonade-server',
        maxTokens: 8192, // Reasoning models (DeepSeek R1) need headroom for chain-of-thought
        temperature: 0.7,
      }));

      console.log('Fetched models from Lemonade Server:', this.availableModels.length);
      return this.availableModels;
    } catch (error) {
      console.error('Failed to fetch models from Lemonade Server:', error);
      
      // Return default Lemonade models as fallback
      this.availableModels = this.getDefaultModels();
      return this.availableModels;
    }
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(conversationHistory: Message[], options?: { maxTokens?: number; maxInputTokens?: number; model?: string }): Promise<string> {
    try {
      // Check server connection first
      if (!this.isConnected) {
        const isHealthy = await this.checkServerHealth();
        if (!isHealthy) {
          throw new Error(
            'Lemonade Server is not running. Please start Lemonade Server at http://localhost:8000'
          );
        }
      }

      // -----------------------------------------------------------------------
      // CONTEXT MANAGEMENT STRATEGY
      // -----------------------------------------------------------------------
      // LLMs are stateless. We must send the "State" (Transcript) + "Identity" (System Prompt)
      // with every request.
      //
      // 1. Chat Mode: Uses a small sliding window (e.g. ~3k tokens) for snappy "Time to First Token".
      // 2. Feedback Mode: Uses the maximum available context (e.g. ~16k) for high-fidelity review.
      //
      // We guarantee zero crashes by mathematically capping the input tokens before sending.
      // -----------------------------------------------------------------------

      // Input budget: model is loaded with ctx_size=16384. Default to 16000 to fully
      // utilise the context window. Callers that need a tighter limit for TTFT
      // (e.g. real-time chat) still pass maxInputTokens explicitly.
      const maxInputTokens = options?.maxInputTokens ?? 16000;

      const truncatedHistory = truncateConversationHistory(conversationHistory, maxInputTokens);

      const totalInputChars = conversationHistory.reduce((s, m) => s + m.content.length, 0);
      const sentInputChars  = truncatedHistory.reduce((s, m) => s + m.content.length, 0);
      const wasTruncated    = truncatedHistory.length < conversationHistory.length;

      const modelToUse = options?.model ?? this.settings.modelName;

      console.log(`[LLM:sendMessage] ── Request ─────────────────────────────────`);
      console.log(`[LLM:sendMessage] model=${modelToUse}`);
      console.log(`[LLM:sendMessage] maxInputTokens=${maxInputTokens}, maxOutputTokens=${options?.maxTokens ?? this.settings.maxTokens}`);
      console.log(`[LLM:sendMessage] messages: ${conversationHistory.length} total → ${truncatedHistory.length} sent${wasTruncated ? ' (TRUNCATED)' : ''}`);
      console.log(`[LLM:sendMessage] input chars: ${totalInputChars} total → ${sentInputChars} sent (~${Math.round(sentInputChars/4)} tokens)`);
      truncatedHistory.forEach((m, i) => console.log(`[LLM:sendMessage]   msg[${i}] role=${m.role}, chars=${m.content.length}`));

      const messages = truncatedHistory
        .filter(msg => msg.role !== 'system' || truncatedHistory.indexOf(msg) === 0)
        .map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        }));

      // Create chat completion using Lemonade Server
      // Use a generous token limit for reasoning models (DeepSeek R1, etc.) that
      // consume tokens for chain-of-thought before producing visible content.
      const maxTokens = options?.maxTokens ?? this.settings.maxTokens;
      const completion = await this.client.chat.completions.create({
        model: modelToUse,
        messages: messages,
        temperature: this.settings.temperature,
        max_tokens: maxTokens,
        stream: false,
      });

      // Defensive: `choices` can be undefined if the server returns an unexpected
      // response shape (e.g. model not fully ready, or server error masked as 200).
      const choice = completion?.choices?.[0];
      let responseContent = choice?.message?.content ?? '';

      // DeepSeek / reasoning models may return empty `content` with a
      // populated `reasoning_content` field.  Try to extract useful output
      // (e.g. JSON) from the reasoning before falling back to the raw text.
      if (!responseContent && choice?.message) {
        const msg = choice.message as any;
        if (msg.reasoning_content) {
          console.warn(
            'Model returned empty content but has reasoning_content — attempting extraction.',
            `finish_reason=${choice.finish_reason}, reasoning length=${msg.reasoning_content.length}`,
          );
          const reasoning: string = msg.reasoning_content;

          // Heuristic: try to find a JSON object embedded in the reasoning text.
          // Reasoning models sometimes include the final answer inside their thinking.
          const jsonStart = reasoning.lastIndexOf('{');
          const jsonEnd = reasoning.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            try {
              JSON.parse(reasoning.slice(jsonStart, jsonEnd + 1));
              // Valid JSON found in reasoning — use just that fragment
              responseContent = reasoning.slice(jsonStart, jsonEnd + 1);
              console.info('Extracted JSON from reasoning_content.');
            } catch {
              // Not valid JSON; fall through to raw reasoning
              responseContent = reasoning;
            }
          } else {
            responseContent = reasoning;
          }
        }
      }

      console.log(`[LLM:sendMessage] ── Response ────────────────────────────────`);
      console.log(`[LLM:sendMessage] finish_reason=${choice?.finish_reason}, response chars=${responseContent?.length ?? 0}`);
      if (responseContent) console.log(`[LLM:sendMessage] response preview: ${responseContent.substring(0, 200)}${responseContent.length > 200 ? '...' : ''}`);

      // If finish_reason is 'length', the model ran out of tokens.
      if (choice?.finish_reason === 'length') {
        console.warn(
          `[LLM:sendMessage] WARNING: Model hit max_tokens limit (${maxTokens}). Response is TRUNCATED. content length=${responseContent?.length ?? 0}`,
        );
      }

      if (!responseContent) {
        // The Lemonade Server router can return HTTP 200 even when the backend
        // (llama-server) returns an error.  The body will contain an `error`
        // object instead of `choices`.  Parse it to surface the *real* message.
        const raw = completion as any;
        const embeddedError =
          raw?.error?.details?.response?.error?.message  // llama-server nested error
          ?? raw?.error?.message                         // router-level error
          ?? raw?.error                                  // plain string error
          ?? null;

        if (embeddedError) {
          console.error('Lemonade Server backend error (masked as 200):', embeddedError);
          throw new Error(`Lemonade Server error: ${embeddedError}`);
        }

        // Truly empty / unexpected shape — log for debugging
        console.warn('Unexpected completion response (no choices):', JSON.stringify(completion)?.slice(0, 500));
        throw new Error('Empty response from Lemonade Server — the model may not be loaded or ready');
      }

      // Clean tool-call artifacts that some models (DeepSeek, Qwen3) embed directly
      // in the content field. These are NOT real function calls — they are part of
      // the model's trained output format and the llamacpp backend does not always
      // strip them. If left in, they appear in the chat UI and get spoken by TTS.
      //
      // Uses cleanForDisplay to preserve formatting (line breaks, lists, markdown)
      // for readable transcript display. TTS-specific cleaning happens separately
      // in VoiceInterviewManager before speech synthesis.
      responseContent = this.cleanResponseContent(responseContent);

      return responseContent;
    } catch (error: any) {
      // Log concisely — avoid dumping entire error objects
      console.error('Error sending message to Lemonade Server:', error.message ?? error);
      
      // Provide helpful error messages
      if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
        throw new Error(
          'Cannot connect to Lemonade Server. Please ensure Lemonade Server is running at ' +
          this.baseURL.replace('/api/v1', '').replace(/\/$/, '')
        );
      }
      
      if (error.status === 404) {
        // Surface the actual server error message (e.g. hardware incompatibility details)
        const serverMessage = error.error?.message || error.message || '';
        if (serverMessage.includes('not available on this system')) {
          throw new Error(serverMessage);
        }
        throw new Error(
          `Model "${this.settings.modelName}" not found. Please load the model in Lemonade Server first.`
        );
      }

      throw new Error(
        error.message || 'Failed to get response from Lemonade Server'
      );
    }
  }

  /**
   * Send a message with **streaming** enabled.
   *
   * Works like `sendMessage()` but yields content tokens as they arrive
   * via a callback, enabling pipelined TTS playback.
   *
   * @param conversationHistory  Full message history (including system prompt)
   * @param onToken              Called for every content token the model produces
   * @param options              Optional overrides (maxTokens)
   * @returns The full accumulated (and cleaned) response text
   */
  async sendMessageStreaming(
    conversationHistory: Message[],
    onToken: (token: string) => void,
    options?: { maxTokens?: number; maxInputTokens?: number },
  ): Promise<string> {
    try {
      if (!this.isConnected) {
        const isHealthy = await this.checkServerHealth();
        if (!isHealthy) {
          throw new Error(
            'Lemonade Server is not running. Please start Lemonade Server at http://localhost:8000',
          );
        }
      }

      // Same fix as sendMessage: use full 16K context by default.
      const maxInputTokens = options?.maxInputTokens ?? 16000;

      const truncatedHistory = truncateConversationHistory(conversationHistory, maxInputTokens);

      const totalInputCharsS  = conversationHistory.reduce((s, m) => s + m.content.length, 0);
      const sentInputCharsS   = truncatedHistory.reduce((s, m) => s + m.content.length, 0);
      const wasTruncatedS     = truncatedHistory.length < conversationHistory.length;

      console.log(`[LLM:streaming] ── Request ──────────────────────────────────`);
      console.log(`[LLM:streaming] model=${this.settings.modelName}`);
      console.log(`[LLM:streaming] maxInputTokens=${maxInputTokens}, maxOutputTokens=${options?.maxTokens ?? this.settings.maxTokens}`);
      console.log(`[LLM:streaming] messages: ${conversationHistory.length} total → ${truncatedHistory.length} sent${wasTruncatedS ? ' (TRUNCATED)' : ''}`);
      console.log(`[LLM:streaming] input chars: ${totalInputCharsS} total → ${sentInputCharsS} sent (~${Math.round(sentInputCharsS/4)} tokens)`);
      truncatedHistory.forEach((m, i) => console.log(`[LLM:streaming]   msg[${i}] role=${m.role}, chars=${m.content.length}`));

      const messages = truncatedHistory
        .filter(
          (msg) => msg.role !== 'system' || truncatedHistory.indexOf(msg) === 0,
        )
        .map((msg) => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        }));

      const maxTokens = options?.maxTokens ?? this.settings.maxTokens;

      // OpenAI SDK v4+: stream returns an async iterable of ChatCompletionChunk
      const stream = await this.client.chat.completions.create({
        model: this.settings.modelName,
        messages,
        temperature: this.settings.temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      let accumulated = '';

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          onToken(delta);
        }
      }

      // Apply the same cleaning used by the non-streaming path
      // (removes tool artifacts, preserves formatting for transcript display)
      accumulated = this.cleanResponseContent(accumulated);

      return accumulated;
    } catch (error: any) {
      console.error('Error in streaming message:', error.message ?? error);

      if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
        throw new Error(
          'Cannot connect to Lemonade Server. Please ensure Lemonade Server is running at ' +
            this.baseURL.replace('/api/v1', '').replace(/\/$/, ''),
        );
      }
      if (error.status === 404) {
        const serverMessage = error.error?.message || error.message || '';
        if (serverMessage.includes('not available on this system')) {
          throw new Error(serverMessage);
        }
        throw new Error(
          `Model "${this.settings.modelName}" not found. Please load the model first.`,
        );
      }

      throw new Error(error.message || 'Failed to get streaming response from Lemonade Server');
    }
  }

  /**
   * Get available models (cached or fetch if needed)
   */
  async getAvailableModels(): Promise<ModelConfig[]> {
    if (this.availableModels.length === 0) {
      await this.fetchAvailableModels();
    }
    return this.availableModels;
  }

  /**
   * List ALL models compatible with this machine (equivalent to `lemonade-server list`).
   * Uses GET /api/v1/models?show_all=true to get every registered model,
   * including not-yet-downloaded ones, with metadata about download status,
   * suggested flag, labels (llm, audio, etc.), and recipe.
   */
  async listAllModels(): Promise<{
    id: string;
    downloaded: boolean;
    suggested: boolean;
    labels: string[];
    recipe?: string;
    size?: number;
    checkpoint?: string;
  }[]> {
    try {
      const response = await axios.get(
        `${this.baseURL}/models`,
        { params: { show_all: 'true' }, timeout: 10000 }
      );

      const models = response.data?.data || [];
      return models.map((m: any) => ({
        id: m.id,
        downloaded: m.downloaded ?? false,
        suggested: m.suggested ?? false,
        labels: m.labels || [],
        recipe: m.recipe || undefined,
        size: m.size || undefined,
        checkpoint: m.checkpoint || undefined,
      }));
    } catch (error: any) {
      console.error('Failed to list all models:', error);
      return [];
    }
  }

  /**
   * Test connection to Lemonade Server
   */
  async testConnection(modelId?: string): Promise<boolean> {
    try {
      // First check server health
      const isHealthy = await this.checkServerHealth();
      if (!isHealthy) {
        return false;
      }

      // If model ID provided, test with that specific model
      if (modelId) {
        const testCompletion = await this.client.chat.completions.create({
          model: modelId,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
        });
        
        return !!testCompletion?.choices?.[0]?.message?.content;
      }

      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Load a model on Lemonade Server
   * Per spec: POST /api/v1/load with model_name parameter
   * Optionally supports ctx_size, llamacpp_backend, llamacpp_args, save_options
   */
  async loadModel(
    modelId: string,
    options?: {
      ctx_size?: number;
      llamacpp_backend?: 'vulkan' | 'rocm' | 'metal' | 'cpu';
      llamacpp_args?: string;
      save_options?: boolean;
    }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/load`,
        { 
          model_name: modelId,  // Per spec: use model_name not model
          ...options
        },
        { timeout: 120000 } // Model loading can take time (120s — load may also install)
      );
      
      return {
        success: response.data.status === 'success',
        message: response.data.message
      };
    } catch (error: any) {
      // Surface detailed server error (e.g. hardware incompatibility, missing backend)
      const serverError = error.response?.data?.error;
      const detailedMessage = typeof serverError === 'string'
        ? serverError
        : serverError?.message || error.response?.data?.message || error.message || 'Failed to load model';
      // Log concisely — avoid dumping the entire AxiosError (hundreds of lines)
      console.error(`Failed to load model "${modelId}":`, detailedMessage, `(HTTP ${error.response?.status ?? 'N/A'})`);
      return {
        success: false,
        message: detailedMessage
      };
    }
  }

  /**
   * Unload a model from Lemonade Server
   * Per spec: POST /api/v1/unload with optional model_name parameter
   * If model_name not provided, unloads all models
   */
  async unloadModel(modelId?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const payload = modelId ? { model_name: modelId } : {};
      const response = await axios.post(
        `${this.baseURL}/unload`,
        payload,
        { timeout: 10000 }
      );
      
      return {
        success: response.data.status === 'success',
        message: response.data.message
      };
    } catch (error: any) {
      const serverError = error.response?.data?.error;
      const detailedMessage = typeof serverError === 'string'
        ? serverError
        : serverError?.message || error.response?.data?.message || error.message || 'Failed to unload model';
      console.error(`Failed to unload model "${modelId ?? 'all'}":`, detailedMessage, `(HTTP ${error.response?.status ?? 'N/A'})`);
      return {
        success: false,
        message: detailedMessage
      };
    }
  }

  /**
   * Pull/download a new model to Lemonade Server
   * Per spec: POST /api/v1/pull with model_name parameter
   * Supports both registered models and custom Hugging Face models
   */
  async pullModel(
    modelId: string,
    options?: {
      checkpoint?: string;
      recipe?: string;
      reasoning?: boolean;
      vision?: boolean;
      embedding?: boolean;
      reranking?: boolean;
      stream?: boolean;
    },
    onProgress?: (progress: { percent: number; file?: string }) => void
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const payload: any = { model_name: modelId };
      
      // If custom model registration is needed
      if (options?.checkpoint) {
        payload.checkpoint = options.checkpoint;
        payload.recipe = options.recipe || 'llamacpp';
        if (options.reasoning) payload.reasoning = true;
        if (options.vision) payload.vision = true;
        if (options.embedding) payload.embedding = true;
        if (options.reranking) payload.reranking = true;
      }
      
      if (options?.stream) {
        payload.stream = true;
      }

      const response = await axios.post(
        `${this.baseURL}/pull`,
        payload,
        {
          timeout: 600000, // 10 minutes for model download
          onDownloadProgress: (progressEvent: any) => {
            if (onProgress && progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onProgress({ percent: percentCompleted });
            }
          },
        }
      );
      
      return {
        success: response.data.status === 'success',
        message: response.data.message
      };
    } catch (error: any) {
      console.error('Failed to pull model:', error);
      // Surface detailed server error (e.g. hardware incompatibility)
      const serverError = error.response?.data?.error;
      const detailedMessage = typeof serverError === 'string'
        ? serverError
        : serverError?.message || error.response?.data?.message || error.message || 'Failed to pull model';
      return {
        success: false,
        message: detailedMessage
      };
    }
  }

  /**
   * Pull/download a model with real-time SSE streaming progress.
   * Per spec: POST /api/v1/pull with stream=true returns Server-Sent Events:
   *   event: progress
   *   data: {"file":"model.gguf","file_index":1,"total_files":2,"bytes_downloaded":...,"bytes_total":...,"percent":40}
   *   event: complete
   *   data: {"file_index":2,"total_files":2,"percent":100}
   */
  async pullModelStreaming(
    modelId: string,
    onProgress: (data: {
      file?: string;
      fileIndex?: number;
      totalFiles?: number;
      bytesDownloaded?: number;
      bytesTotal?: number;
      percent: number;
    }) => void,
  ): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      const payload = JSON.stringify({ model_name: modelId, stream: true });

      // Use Node http to parse SSE stream (axios doesn't handle SSE well)
      const url = new URL(`${this.baseURL}/pull`);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const req = httpModule.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res: any) => {
          if (res.statusCode !== 200) {
            let body = '';
            res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                const errMsg = parsed?.error?.message || parsed?.error || parsed?.message || `HTTP ${res.statusCode}`;
                resolve({ success: false, message: errMsg });
              } catch {
                resolve({ success: false, message: `HTTP ${res.statusCode}: ${body.slice(0, 200)}` });
              }
            });
            return;
          }

          let buffer = '';
          let currentEvent = '';

          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();

            // Parse SSE: lines separated by \n, events separated by \n\n
            const parts = buffer.split('\n');
            buffer = parts.pop() || ''; // keep incomplete line

            for (const line of parts) {
              const trimmed = line.trim();
              if (trimmed.startsWith('event:')) {
                currentEvent = trimmed.slice(6).trim();
              } else if (trimmed.startsWith('data:')) {
                const dataStr = trimmed.slice(5).trim();
                try {
                  const data = JSON.parse(dataStr);
                  if (currentEvent === 'progress' || currentEvent === '') {
                    onProgress({
                      file: data.file,
                      fileIndex: data.file_index,
                      totalFiles: data.total_files,
                      bytesDownloaded: data.bytes_downloaded,
                      bytesTotal: data.bytes_total,
                      percent: data.percent ?? 0,
                    });
                  }
                  // 'complete' event means we're done
                  if (currentEvent === 'complete') {
                    onProgress({ percent: 100 });
                  }
                } catch {
                  // Ignore unparseable lines
                }
                currentEvent = '';
              }
            }
          });

          res.on('end', () => {
            resolve({ success: true, message: `Installed model: ${modelId}` });
          });

          res.on('error', (err: Error) => {
            resolve({ success: false, message: err.message });
          });
        },
      );

      req.on('error', (err: Error) => {
        resolve({ success: false, message: err.message });
      });

      // No timeout — downloads can take a very long time
      req.setTimeout(0);
      req.write(payload);
      req.end();
    });
  }

  /**
   * Delete a model from Lemonade Server
   * Per spec: POST /api/v1/delete (NOT DELETE verb) with model_name parameter
   */
  async deleteModel(modelId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/delete`,
        { model_name: modelId },  // Per spec: use model_name not model
        { timeout: 10000 }
      );
      
      return {
        success: response.data.status === 'success',
        message: response.data.message
      };
    } catch (error: any) {
      console.error('Failed to delete model:', error);
      const serverError = error.response?.data?.error;
      const detailedMessage = typeof serverError === 'string'
        ? serverError
        : serverError?.message || error.response?.data?.message || error.message || 'Failed to delete model';
      return {
        success: false,
        message: detailedMessage
      };
    }
  }

  /**
   * Get the WebSocket port for real-time ASR.
   *
   * The Lemonade Server (when compiled with LEMON_HAS_WEBSOCKET) runs a
   * dedicated WebSocket server on a dynamically assigned port (9000+).
   * This port is exposed as `websocket_port` in the `/health` response.
   *
   * If the field is missing it means the server build does not include
   * WebSocket support, or the WebSocket server failed to start.
   */
  async getWebSocketPort(): Promise<number | null> {
    try {
      const health = await this.fetchServerHealth();
      if (!health) return null;

      // The canonical source: websocket_port from /health
      if (health.websocket_port) {
        console.log(`[getWebSocketPort] Found websocket_port: ${health.websocket_port}`);
        return health.websocket_port;
      }

      // websocket_port is missing — the server likely was NOT compiled
      // with LEMON_HAS_WEBSOCKET, or the WS server did not start.

      // Try to probe the default WebSocket port (9000) as a fallback
      // This handles cases where the server is running but /health doesn't report the port
      const defaultPort = 9000;
      const isPortOpen = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(200); // Quick check
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.on('error', () => {
          resolve(false);
        });
        socket.connect(defaultPort, '127.0.0.1');
      });

      if (isPortOpen) {
        console.log(`[getWebSocketPort] websocket_port not in /health, but port ${defaultPort} is open. Using it.`);
        return defaultPort;
      }

      console.warn(
        '[getWebSocketPort] No websocket_port found in /health response and port 9000 is closed. ' +
        'Real-time transcription requires a lemonade-server build with WebSocket support. ' +
        'Check that LEMON_HAS_WEBSOCKET is enabled in your build.',
      );
      return null;
    } catch (error) {
      console.error('Failed to get WebSocket port:', error);
      return null;
    }
  }

  /**
   * Pre-load required audio models (Whisper for ASR + Kokoro for TTS) on the
   * Lemonade Server. Whisper is of type "audio" and Kokoro is of type "tts".
   * They occupy different type slots, so they can coexist simultaneously
   * as long as each slot has a limit of at least 1.
   *
   * This method:
   *  1. Fetches /health to inspect `max_models.audio` and `max_models.tts`.
   *  2. If either is < 1, logs a prominent warning (the limit is a server-side CLI
   *     argument and cannot be changed via the API).
   *  3. Pre-loads Whisper-Base and kokoro-v1 so both are ready before the user
   *     starts an interview.
   */
  async preloadAudioModels(): Promise<void> {
    try {
      const health = await this.fetchServerHealth();
      if (!health) {
        console.warn('[AudioPreload] Server not reachable — skipping audio model preload.');
        return;
      }

      // --- Check model slot limits for ASR + TTS co-existence ---------------
      // Whisper is type='audio', Kokoro is type='tts' — they occupy DIFFERENT
      // per-type slots, so only warn if either slot is fully unavailable.
      const maxAudio = health.max_models?.audio ?? 1;
      const maxTts = health.max_models?.tts ?? 1;
      if (maxAudio < 1 || maxTts < 1) {
        console.warn(
          '====================================================================\n' +
          '  WARNING: Lemonade Server model slot limits are too restrictive.\n' +
          `  audio slot limit: ${maxAudio} (need ≥1), tts slot limit: ${maxTts} (need ≥1).\n` +
          '  Both Whisper (ASR, type=audio) and Kokoro (TTS, type=tts) must be\n' +
          '  loaded simultaneously. Restart lemonade-server with:\n' +
          '\n' +
          '    lemonade-server serve --max-loaded-models 3\n' +
          '\n' +
          '  Without this, models will evict each other on every switch.\n' +
          '====================================================================',
        );
      }

      // --- Discover which audio models are already loaded ----------------
      const loadedAudioModels = (health.all_models_loaded ?? [])
        .filter(m => m.type === 'audio')
        .map(m => m.model_name);

      console.log('[AudioPreload] Currently loaded audio models:', loadedAudioModels);

      // --- Pre-load Whisper (ASR) if not already loaded ------------------
      const whisperModel = 'Whisper-Base';
      if (!loadedAudioModels.includes(whisperModel)) {
        console.log(`[AudioPreload] Loading ${whisperModel}...`);
        const whisperResult = await this.loadModel(whisperModel);
        console.log(`[AudioPreload] ${whisperModel}:`, whisperResult.message ?? (whisperResult.success ? 'OK' : 'FAILED'));
      } else {
        console.log(`[AudioPreload] ${whisperModel} already loaded.`);
      }

      // --- Pre-load Kokoro (TTS) if not already loaded -------------------
      const kokoroModel = 'kokoro-v1';
      if (!loadedAudioModels.includes(kokoroModel)) {
        console.log(`[AudioPreload] Loading ${kokoroModel}...`);
        const kokoroResult = await this.loadModel(kokoroModel);
        console.log(`[AudioPreload] ${kokoroModel}:`, kokoroResult.message ?? (kokoroResult.success ? 'OK' : 'FAILED'));
      } else {
        console.log(`[AudioPreload] ${kokoroModel} already loaded.`);
      }

      console.log('[AudioPreload] Audio model preload complete.');
    } catch (error: any) {
      console.error('[AudioPreload] Failed to preload audio models:', error.message ?? error);
    }
  }

  /**
   * Update settings and reinitialize client
   */
  updateSettings(newSettings: InterviewerSettings): void {
    this.settings = newSettings;
    // No need to reinitialize client, settings are passed per request
  }

  /**
   * Clean model response content for display in the transcript.
   * Uses cleanForDisplay to preserve formatting (line breaks, lists, etc.)
   * while removing tool-call artifacts.
   * 
   * Note: TTS-specific cleaning (removing markdown for speech) happens
   * separately in VoiceInterviewManager.cleanForTTS() before speaking.
   */
  private cleanResponseContent(content: string): string {
    return TextProcessingService.cleanForDisplay(content);
  }

  /**
   * Get default Lemonade Server models
   */
  private getDefaultModels(): ModelConfig[] {
    return [
      {
        id: 'Llama-3.2-1B-Instruct-Hybrid',
        name: 'Llama 3.2 1B Instruct (Hybrid)',
        provider: 'lemonade-server',
        maxTokens: 8192,
        temperature: 0.7,
      },
      {
        id: 'Llama-3.2-3B-Instruct-Hybrid',
        name: 'Llama 3.2 3B Instruct (Hybrid)',
        provider: 'lemonade-server',
        maxTokens: 8192,
        temperature: 0.7,
      },
      {
        id: 'Phi-3.5-mini-instruct-Hybrid',
        name: 'Phi 3.5 Mini Instruct (Hybrid)',
        provider: 'lemonade-server',
        maxTokens: 8192,
        temperature: 0.7,
      },
      {
        id: 'Qwen2.5-0.5B-Instruct-Hybrid',
        name: 'Qwen 2.5 0.5B Instruct (Hybrid)',
        provider: 'lemonade-server',
        maxTokens: 8192,
        temperature: 0.7,
      },
    ];
  }

  /**
   * Get server base URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Fetch system information from Lemonade Server
   * Per spec: GET /api/v1/system-info
   * Provides hardware capabilities, device info, and available backends
   */
  async fetchSystemInfo(): Promise<{
    os?: string;
    processor?: string;
    memory?: string;
    devices?: {
      cpu?: any;
      amd_igpu?: any;
      amd_dgpu?: any[];
      nvidia_dgpu?: any[];
      npu?: any;
    };
    recipes?: Record<string, any>;
  } | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/system-info`,
        { timeout: 5000 }
      );
      
      console.log('System info fetched:', response.data);
      return {
        os: response.data['OS Version'],
        processor: response.data['Processor'],
        memory: response.data['Physical Memory'],
        devices: response.data.devices,
        recipes: response.data.recipes
      };
    } catch (error) {
      console.error('Failed to fetch system info:', error);
      return null;
    }
  }

  /**
   * Get enhanced health information including loaded models
   * Per spec: GET /api/v1/health
   * Returns all loaded models with their types, devices, and allocations
   */
  async fetchServerHealth(): Promise<{
    status: string;
    model_loaded?: string;
    all_models_loaded?: Array<{
      model_name: string;
      checkpoint: string;
      last_use: number;
      type: 'llm' | 'embedding' | 'reranking' | 'audio' | 'tts' | 'image';
      device: string;
      recipe: string;
      recipe_options?: Record<string, any>;
      backend_url?: string;
    }>;
    max_models?: {
      llm: number;
      embedding: number;
      reranking: number;
      audio: number;
      tts?: number;
      image?: number;
    };
    /** Dynamic WebSocket port reported by the server */
    websocket_port?: number;
  } | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/health`,
        { timeout: 5000 }
      );
      
      console.log('Server health fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch server health:', error);
      return null;
    }
  }

  /**
   * Get performance statistics from the last request
   * Per spec: GET /api/v1/stats
   * Returns timing and token metrics
   */
  async fetchStats(): Promise<{
    time_to_first_token?: number;
    tokens_per_second?: number;
    input_tokens?: number;
    output_tokens?: number;
    decode_token_times?: number[];
    prompt_tokens?: number;
  } | null> {
    try {
      const response = await axios.get(
        `${this.baseURL}/stats`,
        { timeout: 5000 }
      );
      
      console.log('Performance stats fetched:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      return null;
    }
  }
}
