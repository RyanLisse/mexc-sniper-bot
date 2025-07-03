/**
 * Lightweight Performance Monitoring Service
 * Captures simple metrics for API clients.
 */

export interface PerformanceEntry {
  name: string;
  duration: number;
  timestamp: number;
}

export interface PerformanceMonitoringService {
  record(entry: PerformanceEntry): void;
  getEntries(): PerformanceEntry[];
  clear(): void;
}

class BasicPerformanceMonitor implements PerformanceMonitoringService {
  private entries: PerformanceEntry[] = [];

  record(entry: PerformanceEntry): void {
    this.entries.push(entry);
  }

  getEntries(): PerformanceEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

export const performanceMonitoringService = new BasicPerformanceMonitor();

export default performanceMonitoringService;
