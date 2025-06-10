import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Only allow this in development or specific conditions
    const isDev = process.env.NODE_ENV === "development";
    const isDebugMode = process.env.DEBUG_MODE === "true";
    
    if (!isDev && !isDebugMode) {
      return NextResponse.json({ error: "Debug endpoint disabled" }, { status: 403 });
    }

    const debugInfo = {
      step: "starting",
      environment: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL,
      hasAuthSecret: !!process.env.AUTH_SECRET,
      hasDatabaseConfig: !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN),
      error: null
    };

    try {
      debugInfo.step = "importing database";
      const { db } = await import("@/src/db");
      debugInfo.step = "database imported";

      debugInfo.step = "testing database connection";
      // Simple database test
      const { sql } = await import("drizzle-orm");
      await db.run(sql`SELECT 1`);
      debugInfo.step = "database connection successful";

      debugInfo.step = "importing better-auth";
      const { betterAuth } = await import("better-auth");
      const { drizzleAdapter } = await import("better-auth/adapters/drizzle");
      const { username } = await import("better-auth/plugins");
      debugInfo.step = "better-auth modules imported";

      debugInfo.step = "initializing better-auth";
      const auth = betterAuth({
        database: drizzleAdapter(db, {
          provider: "sqlite",
          usePlural: false,
        }),
        plugins: [
          username({
            minUsernameLength: 3,
            maxUsernameLength: 30,
          }),
        ],
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
          minPasswordLength: 8,
          maxPasswordLength: 128,
        },
        session: {
          expiresIn: 60 * 60 * 24 * 7, // 7 days
        },
        secret: process.env.AUTH_SECRET || "development_secret_change_in_production",
        trustedOrigins: [
          "http://localhost:3008",
          "http://localhost:3000",
          "http://localhost:3001",
          "https://mexc-sniper-bot.vercel.app",
        ],
      });
      debugInfo.step = "better-auth initialized successfully";

      return NextResponse.json(debugInfo);
    } catch (error) {
      debugInfo.error = error.message;
      debugInfo.errorStack = error.stack;
      return NextResponse.json(debugInfo, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ 
      error: "Debug check failed", 
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}