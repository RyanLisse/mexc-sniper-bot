import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from "@/src/db";
import { type NewTransaction, transactions } from "@/src/db/schema";
import { 
  apiResponse, 
  createErrorResponse, 
  createPaginatedResponse, 
  createSuccessResponse, 
  createValidationErrorResponse,
  HTTP_STATUS
} from "@/src/lib/api-response";
import { handleApiError } from "@/src/lib/error-handler";

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
      try {
        const fromTimestamp = new Date(fromDate);
        if (isNaN(fromTimestamp.getTime())) {
          return apiResponse(
            createValidationErrorResponse('fromDate', 'Invalid fromDate format'),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        conditions.push(gte(transactions.transactionTime, fromTimestamp));
      } catch (dateError) {
        console.error('Error parsing fromDate:', { fromDate, error: dateError });
        return apiResponse(
          createValidationErrorResponse('fromDate', 'Invalid fromDate format'),
          HTTP_STATUS.BAD_REQUEST
        );
      }
    }

    if (toDate) {
      try {
        const toTimestamp = new Date(toDate);
        if (isNaN(toTimestamp.getTime())) {
          return apiResponse(
            createValidationErrorResponse('toDate', 'Invalid toDate format'),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        conditions.push(lte(transactions.transactionTime, toTimestamp));
      } catch (dateError) {
        console.error('Error parsing toDate:', { toDate, error: dateError });
        return apiResponse(
          createValidationErrorResponse('toDate', 'Invalid toDate format'),
          HTTP_STATUS.BAD_REQUEST
        );
      }
    }

    // Execute query with database error handling
    let userTransactions;
    try {
      userTransactions = await Promise.race([
        db
          .select()
          .from(transactions)
          .where(and(...conditions))
          .orderBy(desc(transactions.transactionTime))
          .limit(limit)
          .offset(offset),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 10000)
        )
      ]);
    } catch (dbError) {
      console.error('Database error in transactions query:', { 
        userId, 
        error: dbError,
        conditions: conditions.length 
      });
      
      // Check if this is a database connectivity issue
      const isDbConnectivityError = dbError instanceof Error && (
        dbError.message.includes('ECONNREFUSED') ||
        dbError.message.includes('timeout') ||
        dbError.message.includes('connection') ||
        dbError.message.includes('ENOTFOUND') ||
        dbError.message.includes('Database query timeout')
      );
      
      if (isDbConnectivityError) {
        return apiResponse(
          createErrorResponse(
            'Database connectivity issue - transactions temporarily unavailable',
            { code: 'DB_CONNECTION_ERROR', retryable: true }
          ),
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }
      
      return apiResponse(
        createErrorResponse(
          'Failed to fetch transactions',
          { code: 'DB_QUERY_ERROR', error: dbError instanceof Error ? dbError.message : String(dbError) }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

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
    console.error('Error fetching transactions:', { error });
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
      buyTimestamp: transactionData.buyTimestamp ? (() => {
        try {
          const date = new Date(transactionData.buyTimestamp!);
          if (isNaN(date.getTime())) {
            throw new Error(`Invalid buyTimestamp: ${transactionData.buyTimestamp}`);
          }
          return date;
        } catch (error) {
          console.error('Error converting buyTimestamp:', { timestamp: transactionData.buyTimestamp, error });
          return new Date(); // Fallback to current time
        }
      })() : undefined,
      buyOrderId: transactionData.buyOrderId,
      sellPrice: transactionData.sellPrice,
      sellQuantity: transactionData.sellQuantity,
      sellTotalRevenue: transactionData.sellTotalRevenue,
      sellTimestamp: transactionData.sellTimestamp ? (() => {
        try {
          const date = new Date(transactionData.sellTimestamp!);
          if (isNaN(date.getTime())) {
            throw new Error(`Invalid sellTimestamp: ${transactionData.sellTimestamp}`);
          }
          return date;
        } catch (error) {
          console.error('Error converting sellTimestamp:', { timestamp: transactionData.sellTimestamp, error });
          return new Date(); // Fallback to current time
        }
      })() : undefined,
      sellOrderId: transactionData.sellOrderId,
      profitLoss: transactionData.profitLoss,
      profitLossPercentage: transactionData.profitLossPercentage,
      fees: transactionData.fees,
      status: transactionData.status,
      snipeTargetId: transactionData.snipeTargetId,
      notes: transactionData.notes,
      transactionTime: new Date(),
    };

    // Execute database insertion with error handling
    let created;
    try {
      [created] = await Promise.race([
        db
          .insert(transactions)
          .values(insertData)
          .returning(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database insert timeout')), 10000)
        )
      ]);
    } catch (dbError) {
      console.error('Database error creating transaction:', { 
        userId: transactionData.userId,
        transactionType: transactionData.transactionType,
        error: dbError 
      });
      
      // Check if this is a database connectivity issue
      const isDbConnectivityError = dbError instanceof Error && (
        dbError.message.includes('ECONNREFUSED') ||
        dbError.message.includes('timeout') ||
        dbError.message.includes('connection') ||
        dbError.message.includes('ENOTFOUND') ||
        dbError.message.includes('Database insert timeout')
      );
      
      if (isDbConnectivityError) {
        return apiResponse(
          createErrorResponse(
            'Database connectivity issue - transaction creation temporarily unavailable',
            { code: 'DB_CONNECTION_ERROR', retryable: true }
          ),
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }
      
      return apiResponse(
        createErrorResponse(
          'Failed to create transaction',
          { code: 'DB_INSERT_ERROR', error: dbError instanceof Error ? dbError.message : String(dbError) }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    return apiResponse(
      createSuccessResponse(created, {
        message: 'Transaction created successfully'
      }),
      HTTP_STATUS.CREATED
    );

  } catch (error) {
    console.error('Error creating transaction:', { error });
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

    // Execute database update with error handling
    let updated;
    try {
      [updated] = await Promise.race([
        db
          .update(transactions)
          .set(updateData)
          .where(eq(transactions.id, id))
          .returning(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database update timeout')), 10000)
        )
      ]);
    } catch (dbError) {
      console.error('Database error updating transaction:', { 
        id,
        error: dbError 
      });
      
      // Check if this is a database connectivity issue
      const isDbConnectivityError = dbError instanceof Error && (
        dbError.message.includes('ECONNREFUSED') ||
        dbError.message.includes('timeout') ||
        dbError.message.includes('connection') ||
        dbError.message.includes('ENOTFOUND') ||
        dbError.message.includes('Database update timeout')
      );
      
      if (isDbConnectivityError) {
        return apiResponse(
          createErrorResponse(
            'Database connectivity issue - transaction update temporarily unavailable',
            { code: 'DB_CONNECTION_ERROR', retryable: true }
          ),
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }
      
      return apiResponse(
        createErrorResponse(
          'Failed to update transaction',
          { code: 'DB_UPDATE_ERROR', error: dbError instanceof Error ? dbError.message : String(dbError) }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

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
    console.error('Error updating transaction:', { error });
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}