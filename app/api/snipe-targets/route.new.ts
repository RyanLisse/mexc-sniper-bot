/**
 * Snipe Targets API - Migrated to new middleware system
 * 
 * This demonstrates how the new middleware system handles authentication,
 * validation, and standardized responses for the snipe targets endpoints.
 */

import { NextRequest } from 'next/server';
import { db } from '@/src/db';
import { snipeTargets } from '@/src/db/schema';
import { eq, and } from 'drizzle-orm';
import { 
  userHandler,
  type ApiContext 
} from '@/src/lib/api-middleware';
import { 
  SnipeTargetsQuerySchema,
  SnipeTargetCreateSchema,
  PaginationSchema 
} from '@/src/lib/api-schemas';
import { HTTP_STATUS } from '@/src/lib/api-response';

// GET /api/snipe-targets?userId=xxx&status=pending&page=1&limit=20
export const GET = userHandler('query', {
  validation: {
    ...SnipeTargetsQuerySchema,
    ...PaginationSchema,
  },
  rateLimit: 'auth',
  logging: true,
})(async (request: NextRequest, context: ApiContext) => {
  const userId = context.searchParams.get('userId')!;
  const status = context.searchParams.get('status');
  const page = Number(context.searchParams.get('page')) || 1;
  const limit = Number(context.searchParams.get('limit')) || 20;

  // Build query conditions
  const conditions = [eq(snipeTargets.userId, userId)];
  if (status) {
    conditions.push(eq(snipeTargets.status, status));
  }

  // Get total count for pagination
  const countResult = await db
    .select()
    .from(snipeTargets)
    .where(and(...conditions));

  const total = countResult.length;

  // Get paginated results
  const targets = await db
    .select()
    .from(snipeTargets)
    .where(and(...conditions))
    .orderBy(snipeTargets.createdAt)
    .limit(limit)
    .offset((page - 1) * limit);

  return context.success(targets, {
    count: targets.length,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    status: status || 'all'
  });
});

// POST /api/snipe-targets
export const POST = userHandler('body', {
  parseBody: true,
  validation: SnipeTargetCreateSchema,
  rateLimit: 'auth',
  logging: true,
})(async (request: NextRequest, context: ApiContext) => {
  const {
    userId,
    vcoinId,
    symbolName,
    entryStrategy = "market",
    entryPrice,
    positionSizeUsdt,
    takeProfitLevel = 2,
    takeProfitCustom,
    stopLossPercent = 5.0,
    status = "pending",
    priority = 1,
    maxRetries = 3,
    targetExecutionTime,
    confidenceScore = 0.0,
    riskLevel = "medium",
  } = context.body;

  const result = await db.insert(snipeTargets).values({
    userId,
    vcoinId,
    symbolName,
    entryStrategy,
    entryPrice,
    positionSizeUsdt,
    takeProfitLevel,
    takeProfitCustom,
    stopLossPercent,
    status,
    priority,
    maxRetries,
    currentRetries: 0,
    targetExecutionTime: targetExecutionTime ? new Date(targetExecutionTime) : null,
    confidenceScore,
    riskLevel,
  }).returning();

  return context.success(result[0], {
    message: "Snipe target created successfully",
  });
});