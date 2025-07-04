import type { NextRequest } from "next/server";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
  HTTP_STATUS,
} from "@/src/lib/api-response";
import { TransactionService } from "@/src/services/transactions/transaction-service";
import {
  createTransactionSchema,
  querySchema,
} from "@/src/services/transactions/transaction-validation";

// GET /api/transactions - Fetch user transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryData = {
      userId: searchParams.get("userId"),
      status: searchParams.get("status"),
      symbolName: searchParams.get("symbolName"),
      transactionType: searchParams.get("transactionType"),
      fromDate: searchParams.get("fromDate"),
      toDate: searchParams.get("toDate"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    };

    const parsed = querySchema.safeParse(queryData);
    if (!parsed.success) {
      return apiResponse(
        createValidationErrorResponse("query", "Invalid query parameters"),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    try {
      const result = await TransactionService.getTransactions(parsed.data);
      const { limit, offset } = parsed.data;

      return apiResponse(
        createSuccessResponse(result, {
          pagination: {
            limit,
            offset,
            hasMore: result.transactions.length === limit,
          },
          count: result.transactions.length,
        })
      );
    } catch (dbError) {
      console.error("Database error in transactions query:", {
        userId: parsed.data.userId,
        error: dbError,
      });

      const isDbConnectivityError =
        TransactionService.isDatabaseConnectivityError(dbError);

      // Return empty transactions with success instead of error to prevent 503
      return apiResponse(
        createSuccessResponse(TransactionService.createEmptyResult(), {
          pagination: {
            limit: parsed.data.limit,
            offset: parsed.data.offset,
            hasMore: false,
          },
          count: 0,
          error: isDbConnectivityError
            ? "Database temporarily unavailable"
            : "Query failed",
          fallback: true,
          retryable: isDbConnectivityError,
        })
      );
    }
  } catch (error) {
    console.error("Error fetching transactions:", { error });
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
        createValidationErrorResponse("body", "Invalid transaction data"),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    try {
      const created = await TransactionService.createTransaction(parsed.data);
      return apiResponse(
        createSuccessResponse(created, {
          message: "Transaction created successfully",
        }),
        HTTP_STATUS.CREATED
      );
    } catch (dbError) {
      console.error("Database error creating transaction:", {
        userId: parsed.data.userId,
        transactionType: parsed.data.transactionType,
        error: dbError,
      });

      const isDbConnectivityError =
        TransactionService.isDatabaseConnectivityError(dbError);

      // Return success with error message instead of failing completely
      return apiResponse(
        createSuccessResponse(null, {
          error: isDbConnectivityError
            ? "Database temporarily unavailable"
            : "Transaction creation failed",
          fallback: true,
          retryable: isDbConnectivityError,
          code: "DB_INSERT_ERROR",
        }),
        HTTP_STATUS.OK
      );
    }
  } catch (error) {
    console.error("Error creating transaction:", { error });
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
        createValidationErrorResponse("id", "Transaction ID is required"),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    try {
      const updated = await TransactionService.updateTransaction(
        id,
        updateData
      );

      if (!updated) {
        return apiResponse(
          createErrorResponse("Transaction not found"),
          HTTP_STATUS.NOT_FOUND
        );
      }

      return apiResponse(
        createSuccessResponse(updated, {
          message: "Transaction updated successfully",
        })
      );
    } catch (dbError) {
      console.error("Database error updating transaction:", {
        id,
        error: dbError,
      });

      const isDbConnectivityError =
        TransactionService.isDatabaseConnectivityError(dbError);

      // Return success with error message instead of failing completely
      return apiResponse(
        createSuccessResponse(null, {
          error: isDbConnectivityError
            ? "Database temporarily unavailable"
            : "Transaction update failed",
          fallback: true,
          retryable: isDbConnectivityError,
          code: "DB_UPDATE_ERROR",
        }),
        HTTP_STATUS.OK
      );
    }
  } catch (error) {
    console.error("Error updating transaction:", { error });
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
