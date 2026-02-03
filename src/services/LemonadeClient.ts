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
  private client: OpenAI;
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
      const response = await axios.get(`${this.baseURL.replace('/api/v1', '')}/api/v1/health`, {
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
  async sendMessage(conversationHistory: Message[], message: string): Promise<string> {
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
          this.baseURL.replace('/api/v1', '')
        );
      }
      
      if (error.status === 404) {
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
   */
  async loadModel(modelId: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseURL}/load`,
        { model: modelId },
        { timeout: 30000 } // Model loading can take time
      );
      
      return response.status === 200;
    } catch (error) {
      console.error('Failed to load model:', error);
      return false;
    }
  }

  /**
   * Unload a model from Lemonade Server
   */
  async unloadModel(modelId: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseURL}/unload`,
        { model: modelId },
        { timeout: 10000 }
      );
      
      return response.status === 200;
    } catch (error) {
      console.error('Failed to unload model:', error);
      return false;
    }
  }

  /**
   * Pull/download a new model to Lemonade Server
   */
  async pullModel(modelId: string, onProgress?: (progress: number) => void): Promise<boolean> {
    try {
      // This is a long-running operation
      const response = await axios.post(
        `${this.baseURL}/pull`,
        { model: modelId },
        {
          timeout: 600000, // 10 minutes for model download
          onDownloadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onProgress(percentCompleted);
            }
          },
        }
      );
      
      return response.status === 200;
    } catch (error) {
      console.error('Failed to pull model:', error);
      return false;
    }
  }

  /**
   * Delete a model from Lemonade Server
   */
  async deleteModel(modelId: string): Promise<boolean> {
    try {
      const response = await axios.delete(
        `${this.baseURL}/delete`,
        {
          data: { model: modelId },
          timeout: 10000,
        }
      );
      
      return response.status === 200;
    } catch (error) {
      console.error('Failed to delete model:', error);
      return false;
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
}
