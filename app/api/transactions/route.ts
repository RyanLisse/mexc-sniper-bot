import { NextRequest, NextResponse } from 'next/server';
import { db } from "../../../src/db";
import { transactions, type NewTransaction } from "../../../src/db/schema";
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS,
  createValidationErrorResponse,
  createPaginatedResponse
} from "../../../src/lib/api-response";
import { handleApiError } from "../../../src/lib/error-handler";

// Validation schemas
const createTransactionSchema = z.object({
  userId: z.string().min(1),
  transactionType: z.enum(['buy', 'sell', 'complete_trade']),
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
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).default('pending'),
  snipeTargetId: z.number().optional(),
  notes: z.string().optional(),
});

const querySchema = z.object({
  userId: z.string().min(1),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).nullable().optional(),
  symbolName: z.string().nullable().optional(),
  transactionType: z.enum(['buy', 'sell', 'complete_trade']).nullable().optional(),
  fromDate: z.string().nullable().optional(), // ISO date string
  toDate: z.string().nullable().optional(), // ISO date string
  limit: z.string().nullable().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().nullable().optional().transform(val => val ? parseInt(val) : 0),
});

// GET /api/transactions - Fetch user transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryData = {
      userId: searchParams.get('userId'),
      status: searchParams.get('status'),
      symbolName: searchParams.get('symbolName'),
      transactionType: searchParams.get('transactionType'),
      fromDate: searchParams.get('fromDate'),
      toDate: searchParams.get('toDate'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    };

    const parsed = querySchema.safeParse(queryData);
    if (!parsed.success) {
      return apiResponse(
        createValidationErrorResponse('query', 'Invalid query parameters'),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { userId, status, symbolName, transactionType, fromDate, toDate, limit, offset } = parsed.data;

    // Build query conditions
    const conditions = [eq(transactions.userId, userId)];

    if (status) {
      conditions.push(eq(transactions.status, status));
    }

    if (symbolName) {
      conditions.push(eq(transactions.symbolName, symbolName));
    }

    if (transactionType) {
      conditions.push(eq(transactions.transactionType, transactionType));
    }

    if (fromDate) {
      const fromTimestamp = new Date(fromDate);
      conditions.push(gte(transactions.transactionTime, fromTimestamp));
    }

    if (toDate) {
      const toTimestamp = new Date(toDate);
      conditions.push(lte(transactions.transactionTime, toTimestamp));
    }

    // Execute query
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.transactionTime))
      .limit(limit)
      .offset(offset);

    // Calculate summary statistics
    const completedTrades = userTransactions.filter((t: typeof userTransactions[0]) => t.status === 'completed' && t.transactionType === 'complete_trade');
    const totalProfitLoss = completedTrades.reduce((sum: number, t: typeof completedTrades[0]) => sum + (t.profitLoss || 0), 0);
    const profitableTrades = completedTrades.filter((t: typeof completedTrades[0]) => (t.profitLoss || 0) > 0);
    const losingTrades = completedTrades.filter((t: typeof completedTrades[0]) => (t.profitLoss || 0) < 0);
    const winRate = completedTrades.length > 0 ? (profitableTrades.length / completedTrades.length) * 100 : 0;

    const summary = {
      totalTransactions: userTransactions.length,
      completedTrades: completedTrades.length,
      totalProfitLoss: totalProfitLoss,
      profitableTrades: profitableTrades.length,
      losingTrades: losingTrades.length,
      winRate: Math.round(winRate * 100) / 100,
      averageProfitLoss: completedTrades.length > 0 ? totalProfitLoss / completedTrades.length : 0,
    };

    return apiResponse(
      createSuccessResponse({
        transactions: userTransactions,
        summary
      }, {
        pagination: {
          limit,
          offset,
          hasMore: userTransactions.length === limit,
        },
        count: userTransactions.length
      })
    );

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

// POST /api/transactions - Create new transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return apiResponse(
        createValidationErrorResponse('body', 'Invalid transaction data'),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const transactionData = parsed.data;

    // Auto-calculate profit/loss for complete trades
    if (transactionData.transactionType === 'complete_trade' && 
        transactionData.buyTotalCost && 
        transactionData.sellTotalRevenue &&
        !transactionData.profitLoss) {
      
      transactionData.profitLoss = transactionData.sellTotalRevenue - transactionData.buyTotalCost;
      transactionData.profitLossPercentage = (transactionData.profitLoss / transactionData.buyTotalCost) * 100;
    }

    // Ensure proper type matching for database insertion
    const insertData: NewTransaction = {
      userId: transactionData.userId,
      transactionType: transactionData.transactionType,
      symbolName: transactionData.symbolName,
      vcoinId: transactionData.vcoinId,
      buyPrice: transactionData.buyPrice,
      buyQuantity: transactionData.buyQuantity,
      buyTotalCost: transactionData.buyTotalCost,
      buyTimestamp: transactionData.buyTimestamp ? new Date(transactionData.buyTimestamp) : undefined,
      buyOrderId: transactionData.buyOrderId,
      sellPrice: transactionData.sellPrice,
      sellQuantity: transactionData.sellQuantity,
      sellTotalRevenue: transactionData.sellTotalRevenue,
      sellTimestamp: transactionData.sellTimestamp ? new Date(transactionData.sellTimestamp) : undefined,
      sellOrderId: transactionData.sellOrderId,
      profitLoss: transactionData.profitLoss,
      profitLossPercentage: transactionData.profitLossPercentage,
      fees: transactionData.fees,
      status: transactionData.status,
      snipeTargetId: transactionData.snipeTargetId,
      notes: transactionData.notes,
      transactionTime: new Date(),
    };

    const [created] = await db
      .insert(transactions)
      .values(insertData)
      .returning();

    return apiResponse(
      createSuccessResponse(created, {
        message: 'Transaction created successfully'
      }),
      HTTP_STATUS.CREATED
    );

  } catch (error) {
    console.error('Error creating transaction:', error);
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

// PUT /api/transactions - Update transaction
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return apiResponse(
        createValidationErrorResponse('id', 'Transaction ID is required'),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Add updated timestamp
    updateData.updatedAt = Math.floor(Date.now() / 1000);

    const [updated] = await db
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id))
      .returning();

    if (!updated) {
      return apiResponse(
        createErrorResponse('Transaction not found'),
        HTTP_STATUS.NOT_FOUND
      );
    }

    return apiResponse(
      createSuccessResponse(updated, {
        message: 'Transaction updated successfully'
      })
    );

  } catch (error) {
    console.error('Error updating transaction:', error);
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}