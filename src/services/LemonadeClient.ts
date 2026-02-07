import OpenAI from 'openai';
import { InterviewerSettings, Message, ModelConfig } from '../types';
import axios from 'axios';

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
        maxTokens: 4096, // Default, can be adjusted
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
  async sendMessage(conversationHistory: Message[]): Promise<string> {
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

      // Convert conversation history to OpenAI format
      const messages = conversationHistory
        .filter(msg => msg.role !== 'system' || conversationHistory.indexOf(msg) === 0)
        .map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        }));

      // Create chat completion using Lemonade Server
      const completion = await this.client.chat.completions.create({
        model: this.settings.modelName,
        messages: messages,
        temperature: this.settings.temperature,
        max_tokens: this.settings.maxTokens,
        stream: false,
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        throw new Error('Empty response from Lemonade Server');
      }

      return responseContent;
    } catch (error: any) {
      console.error('Error sending message to Lemonade Server:', error);
      
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
        
        return !!testCompletion.choices[0]?.message?.content;
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
        { timeout: 60000 } // Model loading can take time (increased to 60s)
      );
      
      return {
        success: response.data.status === 'success',
        message: response.data.message
      };
    } catch (error: any) {
      console.error('Failed to load model:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to load model'
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
      console.error('Failed to unload model:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to unload model'
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
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to delete model'
      };
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
   * Get default Lemonade Server models
   */
  private getDefaultModels(): ModelConfig[] {
    return [
      {
        id: 'Llama-3.2-1B-Instruct-Hybrid',
        name: 'Llama 3.2 1B Instruct (Hybrid)',
        provider: 'lemonade-server',
        maxTokens: 4096,
        temperature: 0.7,
      },
      {
        id: 'Llama-3.2-3B-Instruct-Hybrid',
        name: 'Llama 3.2 3B Instruct (Hybrid)',
        provider: 'lemonade-server',
        maxTokens: 4096,
        temperature: 0.7,
      },
      {
        id: 'Phi-3.5-mini-instruct-Hybrid',
        name: 'Phi 3.5 Mini Instruct (Hybrid)',
        provider: 'lemonade-server',
        maxTokens: 4096,
        temperature: 0.7,
      },
      {
        id: 'Qwen2.5-0.5B-Instruct-Hybrid',
        name: 'Qwen 2.5 0.5B Instruct (Hybrid)',
        provider: 'lemonade-server',
        maxTokens: 4096,
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
      type: 'llm' | 'embedding' | 'reranking' | 'audio';
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
    };
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
