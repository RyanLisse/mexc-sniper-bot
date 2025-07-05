import { type NextRequest, NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getUser,
  syncUserWithDatabase,
} from "@/src/lib/supabase-auth";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Error exchanging code for session:", error);
        return NextResponse.redirect(
          new URL("/auth/error?message=callback_error", request.url)
        );
      }

      // Handle password recovery flow
      if (type === "recovery") {
        console.log("Password recovery callback detected, redirecting to reset page");
        return NextResponse.redirect(
          new URL("/auth/reset-password", request.url)
        );
      }

      // CRITICAL FIX: Sync user with database after successful authentication
      try {
        const user = await getUser();
        if (user) {
          const syncSuccess = await syncUserWithDatabase(user);
          if (!syncSuccess) {
            console.warn(
              "Failed to sync user with database, but continuing with auth"
            );
          } else {
            console.log("Successfully synced user with database:", user.email);
          }
        }
      } catch (syncError) {
        console.error("Error syncing user with database:", syncError);
        // Don't block authentication for sync errors, but log them
      }
    } catch (error) {
      console.error("Error in auth callback:", error);
      return NextResponse.redirect(
        new URL("/auth/error?message=callback_error", request.url)
      );
    }
  }

  // URL to redirect to after sign in process completes
  const redirectUrl =
    requestUrl.searchParams.get("redirect_to") || "/dashboard";
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}
