import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase-auth";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

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
