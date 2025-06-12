import { auth } from "@/src/lib/auth";
import { db } from "@/src/db";
import * as schema from "@/src/db/schema";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    console.log("[Test Auth] Starting auth test...");
    
    // Test 1: Database connection
    const dbTest = await db.select().from(schema.user).limit(1);
    console.log("[Test Auth] Database query successful");
    
    // Test 2: Check if auth object is properly initialized
    const authInfo = {
      authExists: !!auth,
      handlerExists: typeof auth?.handler === 'function',
      authType: typeof auth,
    };
    console.log("[Test Auth] Auth object info:", authInfo);
    
    // Test 3: Try to get session using auth directly
    let sessionTest: { error: string | null; data: any; status?: number } = { error: null, data: null };
    try {
      // Create a mock get-session request
      const mockRequest = new Request('http://localhost:3008/api/auth/get-session', {
        method: 'GET',
        headers: request.headers, // Pass through headers including cookies
      });
      
      const response = await auth.handler(mockRequest);
      const data = await response.json();
      sessionTest = {
        error: null,
        status: response.status,
        data: data,
      };
    } catch (error) {
      const errorObj = error as Error | { message?: string };
      sessionTest = {
        error: errorObj?.message || 'Unknown error',
        data: null,
      };
    }
    
    return NextResponse.json({
      status: 'ok',
      tests: {
        database: {
          connected: true,
          userCount: dbTest.length,
        },
        auth: authInfo,
        session: sessionTest,
      },
      environment: {
        AUTH_SECRET: !!process.env.AUTH_SECRET,
        FORCE_SQLITE: process.env.FORCE_SQLITE,
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
    });
  } catch (error) {
    console.error("[Test Auth] Error:", error);
    const errorObj = error as Error | { message?: string; stack?: string };
    return NextResponse.json({
      status: 'error',
      error: errorObj?.message || 'Unknown error',
      stack: errorObj?.stack,
    }, { status: 500 });
  }
}