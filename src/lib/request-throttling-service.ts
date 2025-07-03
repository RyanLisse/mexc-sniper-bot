/**
 * Request Throttling Service
 * Minimal implementation for build optimization
 */

interface ThrottleRequest {
  id: string;
  priority: number;
  callback: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class RequestThrottlingService {
  private queue: ThrottleRequest[] = [];
  private processing = false;
  private maxConcurrent: number;
  private delayMs: number;

  constructor(maxConcurrent: number = 5, delayMs: number = 100) {
    this.maxConcurrent = maxConcurrent;
    this.delayMs = delayMs;
  }

  async throttle<T>(
    callback: () => Promise<T>,
    priority: number = 1,
    id?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: ThrottleRequest = {
        id: id || Math.random().toString(36),
        priority,
        callback,
        resolve,
        reject,
      };

      this.queue.push(request);
      this.queue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) break;

      try {
        const result = await request.callback();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }

      if (this.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      }
    }

    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue.forEach((request) => {
      request.reject(new Error("Queue cleared"));
    });
    this.queue = [];
  }
}

export const defaultRequestThrottlingService = new RequestThrottlingService();

// Add missing export aliases for compatibility
export const requestThrottlingService = defaultRequestThrottlingService;
