/**
 * Bypass Rate Limit
 * Minimal implementation for build optimization
 */

export interface BypassConfig {
  apiKeys: string[];
  userIds: string[];
  ipAddresses: string[];
}

class BypassRateLimit {
  private config: BypassConfig = {
    apiKeys: [],
    userIds: [],
    ipAddresses: []
  };

  setConfig(config: Partial<BypassConfig>): void {
    this.config = { ...this.config, ...config };
  }

  shouldBypass(context: {
    apiKey?: string;
    userId?: string;
    ipAddress?: string;
  }): boolean {
    if (context.apiKey && this.config.apiKeys.includes(context.apiKey)) {
      return true;
    }

    if (context.userId && this.config.userIds.includes(context.userId)) {
      return true;
    }

    if (context.ipAddress && this.config.ipAddresses.includes(context.ipAddress)) {
      return true;
    }

    return false;
  }

  addBypass(type: 'apiKey' | 'userId' | 'ipAddress', value: string): void {
    switch (type) {
      case 'apiKey':
        if (!this.config.apiKeys.includes(value)) {
          this.config.apiKeys.push(value);
        }
        break;
      case 'userId':
        if (!this.config.userIds.includes(value)) {
          this.config.userIds.push(value);
        }
        break;
      case 'ipAddress':
        if (!this.config.ipAddresses.includes(value)) {
          this.config.ipAddresses.push(value);
        }
        break;
    }
  }

  removeBypass(type: 'apiKey' | 'userId' | 'ipAddress', value: string): void {
    switch (type) {
      case 'apiKey':
        this.config.apiKeys = this.config.apiKeys.filter(key => key !== value);
        break;
      case 'userId':
        this.config.userIds = this.config.userIds.filter(id => id !== value);
        break;
      case 'ipAddress':
        this.config.ipAddresses = this.config.ipAddresses.filter(ip => ip !== value);
        break;
    }
  }
}

export const bypassRateLimit = new BypassRateLimit();

// Missing function for compatibility
export function shouldBypassRateLimit(context: {
  apiKey?: string;
  userId?: string;
  ipAddress?: string;
}): boolean {
  return bypassRateLimit.shouldBypass(context);
}