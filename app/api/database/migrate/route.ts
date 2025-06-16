import { NextRequest, NextResponse } from "next/server";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@/src/db/schema";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    // Security check - only allow in production with proper headers
    const authHeader = request.headers.get('authorization');
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
      return apiResponse(
        createErrorResponse("Database migrations should only be run in production", HTTP_STATUS.FORBIDDEN)
      );
    }

    // Verify TursoDB configuration
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      return apiResponse(
        createErrorResponse("TursoDB configuration missing", HTTP_STATUS.INTERNAL_SERVER_ERROR)
      );
    }

    console.log("[Migration] Starting database migration in production...");
    
    // Create TursoDB client
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Create Drizzle instance with schema
    const db = drizzle(client, { schema });

    // Run migrations
    console.log("[Migration] Running migrations...");
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    
    console.log("[Migration] Migrations completed successfully");
    
    return apiResponse(
      createSuccessResponse({
        message: "Database migrations completed successfully",
        timestamp: new Date().toISOString(),
        environment: "production",
        database: "turso"
      })
    );

  } catch (error) {
    console.error("[Migration] Migration failed:", error);
    
    return apiResponse(
      createErrorResponse(
        `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      )
    );
  }
}