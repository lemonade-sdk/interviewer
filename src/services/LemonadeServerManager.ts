import axios from 'axios';

/**
 * LemonadeServerManager - Manages Lemonade Server connection and status
 * Provides utilities for monitoring and interacting with the local Lemonade Server
 */
export class LemonadeServerManager {
  private baseURL: string;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isServerRunning: boolean = false;
  private onStatusChange?: (isRunning: boolean) => void;

  constructor(baseURL: string = 'http://localhost:8000') {
    this.baseURL = baseURL;
  }

  /**
   * Check if Lemonade Server is running
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v1/health`, {
        timeout: 3000,
      });
      
      const wasRunning = this.isServerRunning;
      this.isServerRunning = response.status === 200;
      
      // Trigger status change callback if status changed
      if (wasRunning !== this.isServerRunning && this.onStatusChange) {
        this.onStatusChange(this.isServerRunning);
      }
      
      return this.isServerRunning;
    } catch (error) {
      const wasRunning = this.isServerRunning;
      this.isServerRunning = false;
      
      if (wasRunning && this.onStatusChange) {
        this.onStatusChange(false);
      }
      
      return false;
    }
  }

  /**
   * Get current server status
   */
  getStatus(): boolean {
    return this.isServerRunning;
  }

  /**
   * Start periodic health checks
   */
  startHealthMonitoring(intervalMs: number = 10000): void {
    // Clear existing interval if any
    this.stopHealthMonitoring();
    
    // Initial health check
    this.checkHealth();
    
    // Set up periodic checks
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, intervalMs);
    
    console.log('Lemonade Server health monitoring started');
  }

  /**
   * Stop periodic health checks
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('Lemonade Server health monitoring stopped');
    }
  }

  /**
   * Set callback for status changes
   */
  onStatusChanged(callback: (isRunning: boolean) => void): void {
    this.onStatusChange = callback;
  }

  /**
   * Get server information
   */
  async getServerInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.baseURL}/api/v1/health`, {
        timeout: 3000,
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to get server information');
    }
  }

  /**
   * Get list of currently loaded models
   */
  async getLoadedModels(): Promise<string[]> {
    try {
      // This endpoint may vary, adjust based on actual Lemonade Server API
      const response = await axios.get(`${this.baseURL}/api/v1/models`, {
        timeout: 5000,
      });
      
      return response.data.data?.map((model: any) => model.id) || [];
    } catch (error) {
      console.error('Failed to get loaded models:', error);
      return [];
    }
  }

  /**
   * Shutdown Lemonade Server (use with caution!)
   */
  async shutdownServer(): Promise<boolean> {
    try {
      const response = await axios.post(`${this.baseURL}/internal/shutdown`, {
        timeout: 5000,
      });
      
      return response.status === 200;
    } catch (error) {
      console.error('Failed to shutdown server:', error);
      return false;
    }
  }

  /**
   * Get base URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Update base URL
   */
  setBaseURL(newBaseURL: string): void {
    this.baseURL = newBaseURL;
  }
}

// Singleton instance for app-wide usage
let serverManagerInstance: LemonadeServerManager | null = null;

export function getLemonadeServerManager(baseURL?: string): LemonadeServerManager {
  if (!serverManagerInstance) {
    serverManagerInstance = new LemonadeServerManager(baseURL);
  } else if (baseURL) {
    serverManagerInstance.setBaseURL(baseURL);
  }
  return serverManagerInstance;
}
