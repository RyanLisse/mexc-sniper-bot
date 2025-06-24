import crypto from "node:crypto";
import { createLogger } from "./structured-logger";

/**
 * NeonDB Branch Management Utility
 *
 * Handles programmatic creation, management, and cleanup of NeonDB branches
 * for isolated testing environments. Each test run gets its own database branch.
 */

interface NeonBranch {
  id: string;
  name: string;
  connectionString: string;
  projectId: string;
  createdAt: Date;
  endpoint?: {
    id: string;
    host: string;
    port: number;
  };
}

interface NeonProject {
  id: string;
  name: string;
  database_host: string;
  database_name: string;
  database_user: string;
  database_password: string;
}

interface CreateBranchResponse {
  branch: {
    id: string;
    name: string;
    project_id: string;
    created_at: string;
  };
  endpoints?: Array<{
    id: string;
    host: string;
    port: number;
  }>;
}

interface NeonConnectionDetails {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslmode: string;
}

export class NeonBranchManager {
  private logger = createLogger("neon-branch-manager");

  private apiKey: string;
  private projectId: string;
  private baseUrl: string;
  private activeBranches: Map<string, NeonBranch> = new Map();

  constructor() {
    this.apiKey = process.env.NEON_API_KEY || "";
    this.projectId = this.extractProjectId(process.env.DATABASE_URL || "");
    this.baseUrl = "https://console.neon.tech/api/v2";

    if (!this.apiKey) {
      throw new Error("NEON_API_KEY environment variable is required for branch management");
    }

    if (!this.projectId) {
      throw new Error("Could not extract project ID from DATABASE_URL");
    }
  }

  /**
   * Extract project ID from NeonDB connection string
   */
  private extractProjectId(databaseUrl: string): string {
    try {
      const url = new URL(databaseUrl);
      // Extract project ID from NeonDB hostname pattern
      // Format: ep-{endpoint-id}-pooler.{region}.aws.neon.tech
      const hostname = url.hostname;
      const match = hostname.match(/ep-([^-]+)-/);

      if (match) {
        return match[1];
      }

      // Alternative: try to extract from connection string parameters
      const params = new URLSearchParams(url.search);
      const projectId = params.get("project_id");
      if (projectId) {
        return projectId;
      }

      // Fallback: use environment variable if available
      if (process.env.NEON_PROJECT_ID) {
        return process.env.NEON_PROJECT_ID;
      }

      throw new Error("Project ID not found in DATABASE_URL");
    } catch (error) {
      logger.error("Failed to extract project ID:", error);
      throw new Error(
        `Invalid DATABASE_URL format: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Generate a unique branch name with timestamp
   */
  private generateBranchName(prefix = "test"): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const randomId = crypto.randomBytes(4).toString("hex");
    return `${prefix}-${timestamp}-${randomId}`;
  }

  /**
   * Make authenticated request to Neon API
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Neon API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Get project information
   */
  async getProject(): Promise<NeonProject> {
    try {
      const project = await this.makeRequest<any>(`/projects/${this.projectId}`);

      return {
        id: project.id,
        name: project.name,
        database_host: project.default_endpoint?.host || "",
        database_name: project.database_name || "neondb",
        database_user: project.database_user || "neondb_owner",
        database_password: project.database_password || "",
      };
    } catch (error) {
      logger.error("Failed to get project info:", error);
      throw new Error(
        `Failed to get project information: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Create a new test branch
   */
  async createTestBranch(
    options: {
      name?: string;
      sourcePoint?: "head" | "now" | string;
      waitForEndpoint?: boolean;
    } = {}
  ): Promise<NeonBranch> {
    const {
      name = this.generateBranchName(),
      sourcePoint = "head",
      waitForEndpoint = true,
    } = options;

    try {
      logger.info(`[NeonBranch] Creating test branch: ${name}`);

      // Create the branch
      const createResponse = await this.makeRequest<CreateBranchResponse>(
        `/projects/${this.projectId}/branches`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            parent_id: sourcePoint === "head" ? undefined : sourcePoint,
            parent_timestamp: sourcePoint === "now" ? new Date().toISOString() : undefined,
          }),
        }
      );

      const branch = createResponse.branch;
      logger.info(`[NeonBranch] Branch created with ID: ${branch.id}`);

      // Wait for endpoint to be ready if requested
      let endpoint = createResponse.endpoints?.[0];
      if (waitForEndpoint && !endpoint) {
        logger.info(`[NeonBranch] Waiting for endpoint to be created...`);
        endpoint = await this.waitForEndpoint(branch.id);
      }

      // Generate connection string
      const connectionString = await this.generateConnectionString(branch.id, endpoint);

      const neonBranch: NeonBranch = {
        id: branch.id,
        name: branch.name,
        connectionString,
        projectId: this.projectId,
        createdAt: new Date(branch.created_at),
        endpoint: endpoint
          ? {
              id: endpoint.id,
              host: endpoint.host,
              port: endpoint.port,
            }
          : undefined,
      };

      // Track the branch
      this.activeBranches.set(branch.id, neonBranch);

      logger.info(`[NeonBranch] Test branch ready: ${name} (${branch.id})`);
      return neonBranch;
    } catch (error) {
      logger.error(`[NeonBranch] Failed to create test branch:`, error);
      throw new Error(
        `Failed to create test branch: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Wait for branch endpoint to be created and ready
   */
  private async waitForEndpoint(
    branchId: string,
    maxWaitTime = 60000
  ): Promise<{ id: string; host: string; port: number }> {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const endpoints = await this.makeRequest<{ endpoints: any[] }>(
          `/projects/${this.projectId}/branches/${branchId}/endpoints`
        );

        if (endpoints.endpoints && endpoints.endpoints.length > 0) {
          const endpoint = endpoints.endpoints[0];
          if (endpoint.current_state === "init" || endpoint.current_state === "active") {
            return {
              id: endpoint.id,
              host: endpoint.host,
              port: endpoint.port || 5432,
            };
          }
        }

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      } catch (error) {
        logger.warn(`[NeonBranch] Error checking endpoint status:`, error);
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }
    }

    throw new Error(`Timeout waiting for endpoint to be ready for branch ${branchId}`);
  }

  /**
   * Generate connection string for a branch
   */
  private async generateConnectionString(
    branchId: string,
    endpoint?: { id: string; host: string; port: number }
  ): Promise<string> {
    try {
      const project = await this.getProject();

      // If no endpoint provided, try to get one
      if (!endpoint) {
        const endpoints = await this.makeRequest<{ endpoints: any[] }>(
          `/projects/${this.projectId}/branches/${branchId}/endpoints`
        );

        if (endpoints.endpoints && endpoints.endpoints.length > 0) {
          const ep = endpoints.endpoints[0];
          endpoint = {
            id: ep.id,
            host: ep.host,
            port: ep.port || 5432,
          };
        }
      }

      if (!endpoint) {
        throw new Error("No endpoint available for branch");
      }

      // Parse the original connection string to get credentials
      const originalUrl = new URL(process.env.DATABASE_URL || "");
      const username = originalUrl.username || project.database_user;
      const password = originalUrl.password || project.database_password;
      const database = originalUrl.pathname.slice(1) || project.database_name;

      // Construct the new connection string
      const connectionString = `postgresql://${username}:${password}@${endpoint.host}:${endpoint.port}/${database}?sslmode=require`;

      return connectionString;
    } catch (error) {
      logger.error("Failed to generate connection string:", error);
      throw new Error(
        `Failed to generate connection string: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Get connection string for an existing branch
   */
  async getBranchConnectionString(branchId: string): Promise<string> {
    try {
      const branch = this.activeBranches.get(branchId);
      if (branch) {
        return branch.connectionString;
      }

      // If not in cache, generate it
      return this.generateConnectionString(branchId);
    } catch (error) {
      logger.error(`Failed to get connection string for branch ${branchId}:`, error);
      throw new Error(
        `Failed to get connection string: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Delete a test branch
   */
  async deleteTestBranch(branchId: string): Promise<void> {
    try {
      logger.info(`[NeonBranch] Deleting test branch: ${branchId}`);

      await this.makeRequest(`/projects/${this.projectId}/branches/${branchId}`, {
        method: "DELETE",
      });

      // Remove from tracking
      this.activeBranches.delete(branchId);

      logger.info(`[NeonBranch] Test branch deleted: ${branchId}`);
    } catch (error) {
      logger.error(`[NeonBranch] Failed to delete test branch ${branchId}:`, error);
      // Don't throw here - cleanup should be best effort
      logger.warn(`[NeonBranch] Branch deletion failed, but continuing...`);
    }
  }

  /**
   * List all test branches (for cleanup)
   */
  async listTestBranches(pattern = "test-"): Promise<NeonBranch[]> {
    try {
      const response = await this.makeRequest<{ branches: any[] }>(
        `/projects/${this.projectId}/branches`
      );

      const testBranches: NeonBranch[] = [];

      for (const branch of response.branches) {
        if (branch.name.startsWith(pattern)) {
          const connectionString = await this.generateConnectionString(branch.id);

          testBranches.push({
            id: branch.id,
            name: branch.name,
            connectionString,
            projectId: this.projectId,
            createdAt: new Date(branch.created_at),
          });
        }
      }

      return testBranches;
    } catch (error) {
      logger.error("Failed to list test branches:", error);
      throw new Error(
        `Failed to list test branches: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Cleanup old test branches
   */
  async cleanupOldTestBranches(
    maxAge: number = 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    pattern = "test-"
  ): Promise<void> {
    try {
      logger.info(
        `[NeonBranch] Cleaning up test branches older than ${maxAge / 1000 / 60} minutes`
      );

      const testBranches = await this.listTestBranches(pattern);
      const now = Date.now();

      for (const branch of testBranches) {
        const age = now - branch.createdAt.getTime();
        if (age > maxAge) {
          logger.info(`[NeonBranch] Cleaning up old branch: ${branch.name} (${branch.id})`);
          await this.deleteTestBranch(branch.id);
        }
      }

      logger.info(`[NeonBranch] Cleanup completed`);
    } catch (error) {
      logger.error("Failed to cleanup old test branches:", error);
      // Don't throw - cleanup should be best effort
    }
  }

  /**
   * Cleanup all tracked branches (for test teardown)
   */
  async cleanupAllTrackedBranches(): Promise<void> {
    logger.info(`[NeonBranch] Cleaning up ${this.activeBranches.size} tracked branches`);

    const promises = Array.from(this.activeBranches.keys()).map((branchId) =>
      this.deleteTestBranch(branchId)
    );

    await Promise.allSettled(promises);
    this.activeBranches.clear();

    logger.info(`[NeonBranch] All tracked branches cleaned up`);
  }

  /**
   * Get active branch count
   */
  getActiveBranchCount(): number {
    return this.activeBranches.size;
  }

  /**
   * Get active branch information
   */
  getActiveBranches(): NeonBranch[] {
    return Array.from(this.activeBranches.values());
  }
}

// Global instance for use across the application
export const neonBranchManager = new NeonBranchManager();
