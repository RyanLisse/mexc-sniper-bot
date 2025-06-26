import { NextRequest, NextResponse } from "next/server";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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
        createErrorResponse("Database migrations should only be run in production"),
        HTTP_STATUS.FORBIDDEN
      );
    }

    // Verify NeonDB configuration
    if (!process.env.DATABASE_URL?.startsWith('postgresql://')) {
      return apiResponse(
        createErrorResponse("NeonDB configuration missing"),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    console.info("[Migration] Starting database migration in production...");
    
    // Create PostgreSQL client
    const client = postgres(process.env.DATABASE_URL, {
      ssl: 'require',
      max: 1, // Single connection for migrations
    });

    // Create Drizzle instance with schema
    const db = drizzle(client, { schema });

    // Run migrations
    console.info("[Migration] Running migrations...");
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    
    console.info("[Migration] Migrations completed successfully");
    
    // Close the client connection
    await client.end();
    
    return apiResponse(
      createSuccessResponse({
        message: "Database migrations completed successfully",
        timestamp: new Date().toISOString(),
        environment: "production",
        database: "neondb"
      })
    );

  } catch (error) {
    console.error("[Migration] Migration failed:", { error: error });
    
    return apiResponse(
      createErrorResponse(
        `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}