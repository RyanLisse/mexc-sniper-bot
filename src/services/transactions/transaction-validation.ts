/**
 * Transaction Validation Schemas
 * Extracted from oversized API route for better maintainability
 */

import { z } from "zod";

export const createTransactionSchema = z.object({
  userId: z.string().min(1),
  transactionType: z.enum(["buy", "sell", "complete_trade"]),
  symbolName: z.string().min(1),
  vcoinId: z.string().optional(),
  buyPrice: z.number().positive().optional(),
  buyQuantity: z.number().positive().optional(),
  buyTotalCost: z.number().positive().optional(),
  buyTimestamp: z.number().optional(),
  buyOrderId: z.string().optional(),
  sellPrice: z.number().positive().optional(),
  sellQuantity: z.number().positive().optional(),
  sellTotalRevenue: z.number().positive().optional(),
  sellTimestamp: z.number().optional(),
  sellOrderId: z.string().optional(),
  profitLoss: z.number().optional(),
  profitLossPercentage: z.number().optional(),
  fees: z.number().min(0).optional(),
  status: z
    .enum(["pending", "completed", "failed", "cancelled"])
    .default("pending"),
  snipeTargetId: z.number().optional(),
  notes: z.string().optional(),
});

export const querySchema = z.object({
  userId: z.string().min(1),
  status: z
    .enum(["pending", "completed", "failed", "cancelled"])
    .nullable()
    .optional(),
  symbolName: z.string().nullable().optional(),
  transactionType: z
    .enum(["buy", "sell", "complete_trade"])
    .nullable()
    .optional(),
  fromDate: z.string().nullable().optional(),
  toDate: z.string().nullable().optional(),
  limit: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? parseInt(val) : 50)),
  offset: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val ? parseInt(val) : 0)),
});

export type CreateTransactionData = z.infer<typeof createTransactionSchema>;
export type QueryTransactionData = z.infer<typeof querySchema>;
