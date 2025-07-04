/**
 * Integration Server Manager
 * 
 * Robust server management for integration tests with advanced health checking,
 * startup optimization, and reliable process lifecycle management.
 */

import { spawn, ChildProcess } from 'child_process';
import { withRetryTimeout, withApiTimeout, createTimeoutPromise, raceWithHealthTimeout } from './timeout-utilities';
import fs from 'fs/promises';
import path from 'path';

export interface ServerConfig {
  port: number;
  env?: Record<string, string>;
  command?: string;
  args?: string[];
  startupTimeout?: number;
  healthCheckTimeout?: number;
  healthCheckInterval?: number;
  maxHealthCheckAttempts?: number;
  logOutput?: boolean;
  enableDevMode?: boolean;
}

export interface ServerStatus {
  isRunning: boolean;
  isReady: boolean;
  port: number;
  pid?: number;
  uptime?: number;
  lastHealthCheck?: Date;
  errors: string[];
  warnings: string[];
}

export interface HealthCheckResult {
  success: boolean;
  status: number;
  responseTime: number;
  endpoint: string;
  error?: string;
  details?: any;
}

/**
 * Advanced integration server manager with comprehensive health checking
 */
export class IntegrationServerManager {
  private serverProcess: ChildProcess | null = null;
  private config: Required<ServerConfig>;
  private status: ServerStatus;
  private startTime: number = 0;
  private healthCheckEndpoints: string[] = [];
  private logBuffer: string[] = [];
  private isStarting = false;
  private isStopping = false;

  constructor(config: ServerConfig) {
    this.config = {
      port: config.port,
      env: { ...process.env, PORT: config.port.toString(), ...config.env },
      command: config.command || 'bun',
      args: config.args || ['run', 'dev'],
      startupTimeout: config.startupTimeout || 90000, // 90 seconds
      healthCheckTimeout: config.healthCheckTimeout || 5000,
      healthCheckInterval: config.healthCheckInterval || 1000,
      maxHealthCheckAttempts: config.maxHealthCheckAttempts || 90,
      logOutput: config.logOutput ?? true,
      enableDevMode: config.enableDevMode ?? true
    };

    this.status = {
      isRunning: false,
      isReady: false,
      port: this.config.port,
      errors: [],
      warnings: []
    };

    // Define comprehensive health check endpoints in priority order
    this.healthCheckEndpoints = [
      '/api/health',
      '/api/health/system',
      '/api/health/db',
      '/health',
      '/ping',
      '/_health',
      '/status'
    ];
  }

  /**
   * Start the development server with robust startup management
   */
  async start(): Promise<ServerStatus> {
    if (this.isStarting) {
      throw new Error('Server startup already in progress');
    }

    if (this.status.isRunning) {
      console.log(`✅ Server already running on port ${this.config.port}`);
      return this.status;
    }

    this.isStarting = true;
    this.startTime = Date.now();
    
    try {
      console.log(`🚀 Starting development server on port ${this.config.port}...`);
      
      // Clean any existing process on the port
      await this.cleanupPort();
      
      // Start the server process
      await this.spawnServerProcess();
      
      // Wait for server to be ready
      await this.waitForServerReady();
      
      console.log(`✅ Server ready on port ${this.config.port} (${Date.now() - this.startTime}ms)`);
      return this.status;
      
    } catch (error) {
      this.status.errors.push(`Startup failed: ${error.message}`);
      await this.stop();
      throw new Error(`Failed to start server: ${error.message}`);
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stop the server with proper cleanup
   */
  async stop(): Promise<void> {
    if (this.isStopping) {
      return;
    }

    this.isStopping = true;
    
    try {
      if (this.serverProcess) {
        console.log(`🛑 Stopping server on port ${this.config.port}...`);
        
        // Try graceful shutdown first
        this.serverProcess.kill('SIGTERM');
        
        // Wait up to 5 seconds for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (this.serverProcess && !this.serverProcess.killed) {
              console.log('⚡ Force killing server process...');
              this.serverProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          if (this.serverProcess) {
            this.serverProcess.on('exit', () => {
              clearTimeout(timeout);
              resolve();
            });
          } else {
            clearTimeout(timeout);
            resolve();
          }
        });

        this.serverProcess = null;
      }

      // Final port cleanup
      await this.cleanupPort();
      
      this.status.isRunning = false;
      this.status.isReady = false;
      this.status.pid = undefined;
      
      console.log(`✅ Server stopped on port ${this.config.port}`);
      
    } catch (error) {
      console.warn(`⚠️ Error during server shutdown:`, error.message);
    } finally {
      this.isStopping = false;
    }
  }

  /**
   * Get current server status
   */
  getStatus(): ServerStatus {
    if (this.status.isRunning && this.startTime) {
      this.status.uptime = Date.now() - this.startTime;
    }
    return { ...this.status };
  }

  /**
   * Perform comprehensive health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const baseUrl = `http://localhost:${this.config.port}`;
    
    // Try each health check endpoint in priority order
    for (const endpoint of this.healthCheckEndpoints) {
      try {
        const startTime = Date.now();
        
        const response = await withApiTimeout(
          () => fetch(`${baseUrl}${endpoint}`),
          this.config.healthCheckTimeout
        );
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          let details;
          try {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
              details = await response.json();
            }
          } catch {
            // Ignore JSON parsing errors
          }

          return {
            success: true,
            status: response.status,
            responseTime,
            endpoint,
            details
          };
        }
      } catch (error) {
        // Continue to next endpoint
        continue;
      }
    }

    // If all endpoints fail, try basic connectivity
    try {
      const response = await withApiTimeout(
        () => fetch(baseUrl),
        this.config.healthCheckTimeout
      );
      
      return {
        success: response.status < 500,
        status: response.status,
        responseTime: this.config.healthCheckTimeout,
        endpoint: '/',
        error: response.status >= 500 ? `Server error: ${response.status}` : undefined
      };
    } catch (error) {
      return {
        success: false,
        status: 0,
        responseTime: this.config.healthCheckTimeout,
        endpoint: 'connection_failed',
        error: error.message
      };
    }
  }

  /**
   * Wait for multiple successful health checks
   */
  async waitForStableHealth(requiredSuccessCount: number = 3): Promise<void> {
    let successCount = 0;
    let attempts = 0;
    const maxAttempts = 20;

    while (successCount < requiredSuccessCount && attempts < maxAttempts) {
      attempts++;
      
      const result = await this.healthCheck();
      
      if (result.success) {
        successCount++;
        console.log(`✅ Health check ${successCount}/${requiredSuccessCount} passed (${result.endpoint})`);
      } else {
        successCount = 0; // Reset counter on failure
        console.log(`⚠️ Health check failed, resetting counter (${result.error})`);
      }
      
      if (successCount < requiredSuccessCount) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (successCount < requiredSuccessCount) {
      throw new Error(`Failed to achieve stable health after ${attempts} attempts`);
    }
  }

  /**
   * Get server logs (last N lines)
   */
  getLogs(lines: number = 50): string[] {
    return this.logBuffer.slice(-lines);
  }

  /**
   * Clear accumulated logs
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Spawn the server process with comprehensive monitoring
   */
  private async spawnServerProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`📦 Spawning: ${this.config.command} ${this.config.args.join(' ')}`);
      
      this.serverProcess = spawn(this.config.command, this.config.args, {
        env: this.config.env,
        stdio: 'pipe',
        detached: false
      });

      if (!this.serverProcess || !this.serverProcess.pid) {
        reject(new Error('Failed to spawn server process'));
        return;
      }

      this.status.pid = this.serverProcess.pid;
      this.status.isRunning = true;

      // Handle process output
      if (this.serverProcess.stdout) {
        this.serverProcess.stdout.on('data', (data) => {
          const output = data.toString();
          this.logBuffer.push(`[OUT] ${output}`);
          
          if (this.config.logOutput) {
            console.log(`[Server] ${output.trim()}`);
          }
          
          // Keep log buffer manageable
          if (this.logBuffer.length > 1000) {
            this.logBuffer = this.logBuffer.slice(-500);
          }
        });
      }

      if (this.serverProcess.stderr) {
        this.serverProcess.stderr.on('data', (data) => {
          const output = data.toString();
          this.logBuffer.push(`[ERR] ${output}`);
          
          if (this.config.logOutput) {
            console.error(`[Server Error] ${output.trim()}`);
          }
          
          // Check for startup errors
          if (output.toLowerCase().includes('error') || output.toLowerCase().includes('failed')) {
            this.status.errors.push(output.trim());
          }
        });
      }

      // Handle process events
      this.serverProcess.on('error', (error) => {
        this.status.errors.push(`Process error: ${error.message}`);
        reject(new Error(`Server process error: ${error.message}`));
      });

      this.serverProcess.on('exit', (code, signal) => {
        console.log(`🔄 Server process exited with code ${code}, signal ${signal}`);
        this.status.isRunning = false;
        this.status.isReady = false;
        this.status.pid = undefined;
        
        if (code !== 0 && !this.isStopping) {
          this.status.errors.push(`Process exited with code ${code}`);
        }
      });

      // Wait a moment for process to stabilize
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          resolve();
        } else {
          reject(new Error('Server process died during startup'));
        }
      }, 2000);
    });
  }

  /**
   * Wait for server to be ready with progressive timeout
   */
  private async waitForServerReady(): Promise<void> {
    console.log(`⏳ Waiting for server readiness on port ${this.config.port}...`);
    
    let attempts = 0;
    let lastError = '';
    
    const checkReady = async (): Promise<boolean> => {
      attempts++;
      
      try {
        const result = await this.healthCheck();
        
        if (result.success) {
          this.status.isReady = true;
          this.status.lastHealthCheck = new Date();
          console.log(`✅ Server ready (attempt ${attempts}, endpoint: ${result.endpoint}, ${result.responseTime}ms)`);
          return true;
        } else {
          lastError = result.error || `Status ${result.status}`;
          console.log(`⏳ Server not ready (attempt ${attempts}/${this.config.maxHealthCheckAttempts}): ${lastError}`);
          return false;
        }
      } catch (error) {
        lastError = error.message;
        console.log(`⏳ Health check failed (attempt ${attempts}/${this.config.maxHealthCheckAttempts}): ${lastError}`);
        return false;
      }
    };

    // Use retry with progressive backoff
    return withRetryTimeout(
      async () => {
        const isReady = await checkReady();
        if (!isReady) {
          throw new Error(`Server not ready: ${lastError}`);
        }
        return true;
      },
      {
        maxRetries: this.config.maxHealthCheckAttempts,
        timeout: this.config.healthCheckTimeout,
        retryDelay: this.config.healthCheckInterval,
        testType: 'integration'
      }
    );
  }

  /**
   * Clean up any existing process on the port
   */
  private async cleanupPort(): Promise<void> {
    try {
      // Check if port is in use
      const isPortInUse = await this.isPortInUse(this.config.port);
      
      if (isPortInUse) {
        console.log(`🧹 Cleaning up port ${this.config.port}...`);
        
        // Try to find and kill process using the port
        try {
          const { spawn } = await import('child_process');
          
          if (process.platform === 'win32') {
            // Windows
            spawn('taskkill', ['/F', '/IM', 'node.exe'], { stdio: 'ignore' });
          } else {
            // Unix-like systems
            spawn('pkill', ['-f', `PORT=${this.config.port}`], { stdio: 'ignore' });
          }
        } catch (error) {
          // Ignore cleanup errors
        }
        
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      // Ignore port cleanup errors
      console.warn(`⚠️ Port cleanup warning:`, error.message);
    }
  }

  /**
   * Check if a port is in use
   */
  private async isPortInUse(port: number): Promise<boolean> {
    try {
      const response = await withApiTimeout(
        () => fetch(`http://localhost:${port}`),
        1000
      );
      return true; // If we get any response, port is in use
    } catch {
      return false; // Port is free
    }
  }
}

/**
 * Shared server instance management for test suites
 */
export class SharedServerManager {
  private static instances = new Map<number, IntegrationServerManager>();
  private static startupPromises = new Map<number, Promise<ServerStatus>>();

  /**
   * Get or create a shared server instance for a port
   */
  static async getServer(config: ServerConfig): Promise<IntegrationServerManager> {
    const port = config.port;
    
    if (!this.instances.has(port)) {
      const server = new IntegrationServerManager(config);
      this.instances.set(port, server);
    }

    const server = this.instances.get(port)!;
    
    // Ensure server is started (handle concurrent startup attempts)
    if (!this.startupPromises.has(port)) {
      const status = server.getStatus();
      
      if (!status.isRunning && !status.isReady) {
        console.log(`🚀 Starting shared server on port ${port}...`);
        this.startupPromises.set(port, server.start());
      }
    }

    // Wait for startup if in progress
    const startupPromise = this.startupPromises.get(port);
    if (startupPromise) {
      await startupPromise;
      this.startupPromises.delete(port);
    }

    return server;
  }

  /**
   * Stop and remove a shared server instance
   */
  static async stopServer(port: number): Promise<void> {
    const server = this.instances.get(port);
    if (server) {
      await server.stop();
      this.instances.delete(port);
      this.startupPromises.delete(port);
    }
  }

  /**
   * Stop all shared server instances
   */
  static async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.instances.keys()).map(port => this.stopServer(port));
    await Promise.all(stopPromises);
  }

  /**
   * Get status of all shared servers
   */
  static getAllServerStatus(): Record<number, ServerStatus> {
    const status: Record<number, ServerStatus> = {};
    
    for (const [port, server] of this.instances) {
      status[port] = server.getStatus();
    }
    
    return status;
  }
}

/**
 * Utility function for integration tests to quickly get a ready server
 */
export async function setupIntegrationServer(config: Partial<ServerConfig> = {}): Promise<{
  server: IntegrationServerManager;
  baseUrl: string;
  port: number;
}> {
  const defaultConfig: ServerConfig = {
    port: parseInt(process.env.TEST_PORT || '3109'),
    env: {
      NODE_ENV: 'test',
      USE_REAL_DATABASE: 'true',
      FORCE_MOCK_DB: 'false'
    },
    ...config
  };

  const server = await SharedServerManager.getServer(defaultConfig);
  
  return {
    server,
    baseUrl: `http://localhost:${defaultConfig.port}`,
    port: defaultConfig.port
  };
}

/**
 * Cleanup function for test teardown
 */
export async function teardownIntegrationServers(): Promise<void> {
  await SharedServerManager.stopAllServers();
}