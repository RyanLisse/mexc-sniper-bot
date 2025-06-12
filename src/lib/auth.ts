import { db } from "@/src/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import * as schema from "@/src/db/schema";

console.log("Initializing better-auth...");

// Verify database connection before initializing auth
async function verifyDatabase() {
  try {
    // Test database connection
    const testQuery = await db.select().from(schema.user).limit(1);
    console.log("Database connection verified for auth");
    return true;
  } catch (error) {
    console.error("Database verification failed:", error);
    return false;
  }
}

// Run verification
verifyDatabase().catch(console.error);

// Email sending function for development (console log)
// In production, replace with actual email service
const sendEmailDev = async ({
  to,
  subject,
  text,
}: { to: string; subject: string; text: string }) => {
  console.log("📧 Email would be sent:");
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Content: ${text}`);
  console.log("In production, configure with real email service");
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite", // SQLite for local dev, TursoDB uses libsql which is SQLite-compatible
    usePlural: false,
  }),
  basePath: "/api/auth", // Explicitly set the base path
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
    }),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url, token: _token }, _request) => {
      await sendEmailDev({
        to: user.email,
        subject: "Reset your password - MEXC Sniper Bot",
        text: `Click the link to reset your password: ${url}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this password reset, please ignore this email.`,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token: _token }, _request) => {
      await sendEmailDev({
        to: user.email,
        subject: "Verify your email - MEXC Sniper Bot",
        text: `Welcome to MEXC Sniper Bot!\n\nClick the link to verify your email address: ${url}\n\nThis link will expire in 24 hours.`,
      });
    },
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

console.log("Better-auth initialized successfully");

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
