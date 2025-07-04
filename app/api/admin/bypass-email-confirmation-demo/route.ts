import type { NextRequest } from "next/server";
import { apiResponse } from "@/src/lib/api-response";

/**
 * Email Confirmation Bypass API Demo
 * 
 * POST /api/admin/bypass-email-confirmation-demo - Demo version for testing
 * 
 * This is a demo version that shows the API structure without requiring
 * valid Supabase credentials. Use this for testing the API endpoint structure.
 */

export async function POST(request: NextRequest) {
  try {
    // Only allow in development/test environments for security
    if (process.env.NODE_ENV === "production") {
      return apiResponse.error("Demo endpoint not allowed in production", 403);
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

    console.log(`[EMAIL BYPASS DEMO] Simulating email confirmation bypass for: ${email}`);

    // Simulate the API behavior without actually connecting to Supabase
    const mockResponse = {
      message: `Successfully bypassed email confirmation for: ${email}`,
      user: {
        id: "demo-user-id-123",
        email: email,
        emailConfirmed: true,
        emailConfirmedAt: new Date().toISOString()
      },
      bypassed: true,
      timestamp: new Date().toISOString(),
      note: "This is a demo response. To use the real API, ensure valid Supabase credentials are configured."
    };

    return apiResponse.success(mockResponse);

  } catch (error) {
    console.error("[EMAIL BYPASS DEMO] Error:", error);
    return apiResponse.error("Failed to process demo request", 500, { 
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Only allow POST requests
export async function GET() {
  return apiResponse.success({
    message: "Email Confirmation Bypass Demo API",
    usage: "Send POST request with { email: 'user@example.com' }",
    note: "This is a demo endpoint. Use POST /api/admin/bypass-email-confirmation for production."
  });
}

export async function PUT() {
  return apiResponse.error("Method not allowed. Use POST request.", 405);
}

export async function DELETE() {
  return apiResponse.error("Method not allowed. Use POST request.", 405);
}