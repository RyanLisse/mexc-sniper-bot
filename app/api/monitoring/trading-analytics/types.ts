/**
 * Trading Analytics API Types
 *
 * Type definitions for trading analytics API endpoints.
 * Extracted from the main route handler for better modularity.
 */

export interface TradeRecord {
  status: string;
  profitLoss?: number;
  buyTotalCost?: number;
  createdAt: string;
}

export interface PortfolioSnapshot {
  timestamp: string;
  totalBalance?: number;
}

export interface PatternEmbedding {
  patternType: string;
  confidence?: number;
  isActive?: boolean;
  truePositives?: number;
  createdAt: string;
}

export interface SnipeTarget {
  symbolName: string;
  positionSizeUsdt?: number;
  createdAt: string;
  status: string;
}
