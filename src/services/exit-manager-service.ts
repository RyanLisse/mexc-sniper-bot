import { OptimizedAutoExitManager } from "./optimized-auto-exit-manager";

/**
 * Global singleton service for managing the AutoExitManager
 */
class ExitManagerService {
  private static instance: ExitManagerService;
  private autoExitManager: OptimizedAutoExitManager;

  private constructor() {
    this.autoExitManager = new OptimizedAutoExitManager();
  }

  public static getInstance(): ExitManagerService {
    if (!ExitManagerService.instance) {
      ExitManagerService.instance = new ExitManagerService();
    }
    return ExitManagerService.instance;
  }

  /**
   * Start the auto exit manager
   */
  async start(): Promise<void> {
    await this.autoExitManager.startMonitoring();
  }

  /**
   * Stop the auto exit manager
   */
  stop(): void {
    this.autoExitManager.stopMonitoring();
  }

  /**
   * Get the status of the auto exit manager
   */
  getStatus() {
    return this.autoExitManager.getStatus();
  }

  /**
   * Get the auto exit manager instance
   */
  getManager(): OptimizedAutoExitManager {
    return this.autoExitManager;
  }
}

// Export singleton instance
export const exitManagerService = ExitManagerService.getInstance();
