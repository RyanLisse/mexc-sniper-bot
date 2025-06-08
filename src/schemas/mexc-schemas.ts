import { z } from "zod";

// Core MEXC API Schemas
export const CalendarEntrySchema = z.object({
  vcoinId: z.string(),
  symbol: z.string(),
  projectName: z.string(),
  firstOpenTime: z.number(),
});

export const SymbolV2EntrySchema = z.object({
  cd: z.string(), // vcoinId
  ca: z.string().optional(), // contract address
  ps: z.number().optional(), // price scale
  qs: z.number().optional(), // quantity scale
  sts: z.number(), // symbol trading status
  st: z.number(), // state
  tt: z.number(), // trading type
  ot: z.number().optional(), // open time
});

export const SnipeTargetSchema = z.object({
  vcoinId: z.string(),
  symbol: z.string(),
  projectName: z.string(),
  priceDecimalPlaces: z.number(),
  quantityDecimalPlaces: z.number(),
  launchTime: z.date(),
  discoveredAt: z.date(),
  hoursAdvanceNotice: z.number(),
  orderParameters: z.record(z.any()),
});

// API Response Schemas
export const CalendarResponseSchema = z.object({
  data: z.array(CalendarEntrySchema),
});

export const SymbolsV2ResponseSchema = z.object({
  data: z.object({
    symbols: z.array(SymbolV2EntrySchema),
  }),
});

// Trading Order Schema
export const OrderParametersSchema = z.object({
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT", "STOP_LOSS", "STOP_LOSS_LIMIT"]),
  quantity: z.number().optional(),
  quoteOrderQty: z.number().optional(),
  price: z.number().optional(),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
});

// Pattern Matching Schema
export const ReadyStatePatternSchema = z.object({
  sts: z.number(),
  st: z.number(),
  tt: z.number(),
});

// Sniper State Schema
export const SniperStatsSchema = z.object({
  totalListings: z.number(),
  pendingDetection: z.number(),
  readyToSnipe: z.number(),
  executed: z.number(),
  uptime: z.number().optional(),
  successRate: z.number().optional(),
});

// Error Schema
export const MexcErrorSchema = z.object({
  code: z.number().optional(),
  message: z.string(),
  details: z.any().optional(),
});

// Type inference exports
export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type SymbolV2Entry = z.infer<typeof SymbolV2EntrySchema>;
export type SnipeTarget = z.infer<typeof SnipeTargetSchema>;
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;
export type SymbolsV2Response = z.infer<typeof SymbolsV2ResponseSchema>;
export type OrderParameters = z.infer<typeof OrderParametersSchema>;
export type ReadyStatePattern = z.infer<typeof ReadyStatePatternSchema>;
export type SniperStats = z.infer<typeof SniperStatsSchema>;
export type MexcError = z.infer<typeof MexcErrorSchema>;

// Constants
export const READY_STATE_PATTERN: ReadyStatePattern = {
  sts: 2,
  st: 2,
  tt: 4,
} as const;

// Validation helpers
export const validateCalendarEntry = (data: unknown): CalendarEntry => {
  return CalendarEntrySchema.parse(data);
};

export const validateSymbolV2Entry = (data: unknown): SymbolV2Entry => {
  return SymbolV2EntrySchema.parse(data);
};

export const validateSnipeTarget = (data: unknown): SnipeTarget => {
  return SnipeTargetSchema.parse(data);
};

// Pattern matching utilities
export const matchesReadyPattern = (symbol: SymbolV2Entry): boolean => {
  return (
    symbol.sts === READY_STATE_PATTERN.sts &&
    symbol.st === READY_STATE_PATTERN.st &&
    symbol.tt === READY_STATE_PATTERN.tt
  );
};

export const hasCompleteData = (symbol: SymbolV2Entry): boolean => {
  return !!(symbol.ca && symbol.ps && symbol.qs && symbol.ot);
};

export const isValidForSnipe = (symbol: SymbolV2Entry): boolean => {
  return matchesReadyPattern(symbol) && hasCompleteData(symbol);
};
