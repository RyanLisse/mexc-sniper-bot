import type { NextRequest } from "next/server";
import { apiResponse } from "@/src/lib/api-response";
import { requireAuth, createSupabaseAdminClient } from "@/src/lib/supabase-auth";

/**
 * Email Confirmation Bypass API
 * 
 * POST /api/admin/bypass-email-confirmation - Bypass email confirmation for a user
 * 
 * Security: Only works in development/test environments
 */

export async function POST(request: NextRequest) {
  try {
    // Only allow in development/test environments for security
    if (process.env.NODE_ENV === "production") {
      return apiResponse.error("Email confirmation bypass not allowed in production", 403);
    }

    // For testing purposes, skip authentication in development if TEST_MODE is enabled
    const testMode = process.env.NODE_ENV === "development" && process.env.TEST_MODE === "true";
    
    if (!testMode) {
      // Verify authentication
      const user = await requireAuth();
      if (!user) {
        return apiResponse.unauthorized("Authentication required");
      }

      // For security, only allow specific admin users or in development
      const isAdmin = 
        user.email?.includes("admin") || 
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test";

      if (!isAdmin) {
        return apiResponse.error("Admin access required for email confirmation bypass", 403);
      }
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return apiResponse.badRequest("Email parameter is required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiResponse.badRequest("Invalid email format");
    }

    console.log(`[EMAIL BYPASS API] Bypassing email confirmation for: ${email}`);

    const supabase = createSupabaseAdminClient();
    
    // Find the user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("[EMAIL BYPASS API] Error listing users:", listError);
      return apiResponse.error("Failed to list users", 500, { error: listError.message });
    }

    const targetUser = users.users.find(u => u.email === email);
    
    if (!targetUser) {
      return apiResponse.error(`User not found with email: ${email}`, 404);
    }

    if (targetUser.email_confirmed_at) {
      return apiResponse.success({
        message: `User ${targetUser.email} is already confirmed`,
        user: {
          id: targetUser.id,
          email: targetUser.email,
          emailConfirmed: true,
          emailConfirmedAt: targetUser.email_confirmed_at
        },
        alreadyConfirmed: true,
        timestamp: new Date().toISOString()
      });
    }

    // Update user to confirm email
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      targetUser.id,
      {
        email_confirm: true,
      }
    );

    if (updateError) {
      console.error("[EMAIL BYPASS API] Error confirming email:", updateError);
      return apiResponse.error("Failed to confirm email", 500, { error: updateError.message });
    }

    console.log(`[EMAIL BYPASS API] Successfully bypassed email confirmation for: ${email}`);

    // Fetch updated user to confirm the change
    const { data: updatedUser, error: fetchError } = await supabase.auth.admin.getUserById(targetUser.id);
    
    if (fetchError) {
      console.warn("[EMAIL BYPASS API] Warning: Could not fetch updated user:", fetchError);
    }

    return apiResponse.success({
      message: `Successfully bypassed email confirmation for: ${email}`,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        emailConfirmed: true,
        emailConfirmedAt: updatedUser?.user?.email_confirmed_at || new Date().toISOString()
      },
      bypassed: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[EMAIL BYPASS API] Error:", error);
    return apiResponse.error("Failed to bypass email confirmation", 500, { 
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Only allow POST requests
export async function GET() {
  return apiResponse.error("Method not allowed. Use POST request.", 405);
}

export async function PUT() {
  return apiResponse.error("Method not allowed. Use POST request.", 405);
}

export async function DELETE() {
  return apiResponse.error("Method not allowed. Use POST request.", 405);
}