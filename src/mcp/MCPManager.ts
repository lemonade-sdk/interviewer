import { MCPServer } from '../types';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/**
 * MCPManager - Model Context Protocol server manager
 * Manages MCP server processes and communication
 */
export class MCPManager extends EventEmitter {
  private servers: Map<string, MCPServerInstance> = new Map();
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load MCP servers from configuration
    // For MVP, we'll start with no servers configured
    // Users can add them through the settings UI

    this.initialized = true;
    console.log('MCP Manager initialized');
  }

  async startServer(config: MCPServer): Promise<void> {
    if (this.servers.has(config.id)) {
      console.log(`MCP server ${config.name} is already running`);
      return;
    }

    try {
      const serverProcess = spawn(config.command, config.args, {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const instance: MCPServerInstance = {
        config,
        process: serverProcess,
        isRunning: true,
      };

      serverProcess.on('error', (error: Error) => {
        console.error(`MCP server ${config.name} error:`, error);
        instance.isRunning = false;
        this.emit('server:error', { serverId: config.id, error });
      });

      serverProcess.on('exit', (code: number | null) => {
        console.log(`MCP server ${config.name} exited with code ${code}`);
        instance.isRunning = false;
        this.servers.delete(config.id);
        this.emit('server:exit', { serverId: config.id, code });
      });

      serverProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`[${config.name}] ${data.toString()}`);
      });

      serverProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[${config.name}] ${data.toString()}`);
      });

      this.servers.set(config.id, instance);
      this.emit('server:started', { serverId: config.id });

      console.log(`MCP server ${config.name} started successfully`);
    } catch (error) {
      console.error(`Failed to start MCP server ${config.name}:`, error);
      throw error;
    }
  }

  async stopServer(serverId: string): Promise<void> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      console.log(`MCP server ${serverId} is not running`);
      return;
    }

    return new Promise((resolve) => {
      instance.process.on('exit', () => {
        this.servers.delete(serverId);
        this.emit('server:stopped', { serverId });
        resolve();
      });

      instance.process.kill();

      // Force kill after 5 seconds if not stopped
      setTimeout(() => {
        if (instance.isRunning) {
          instance.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  async restartServer(serverId: string): Promise<void> {
    const instance = this.servers.get(serverId);
    if (!instance) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    const config = instance.config;
    await this.stopServer(serverId);
    await this.startServer(config);
  }

  getServers(): MCPServer[] {
    return Array.from(this.servers.values()).map(instance => instance.config);
  }

  async updateServers(servers: MCPServer[]): Promise<void> {
    // Stop all existing servers
    const stopPromises = Array.from(this.servers.keys()).map(id => this.stopServer(id));
    await Promise.all(stopPromises);

    // Start enabled servers
    const startPromises = servers
      .filter(server => server.enabled)
      .map(server => this.startServer(server));

    await Promise.all(startPromises);
  }

  isServerRunning(serverId: string): boolean {
    const instance = this.servers.get(serverId);
    return instance ? instance.isRunning : false;
  }

  shutdown(): void {
    console.log('Shutting down MCP Manager...');
    
    for (const [serverId, instance] of this.servers) {
      if (instance.isRunning) {
        instance.process.kill();
      }
    }

    this.servers.clear();
    this.initialized = false;
  }
}

interface MCPServerInstance {
  config: MCPServer;
  process: ChildProcess;
  isRunning: boolean;
}
