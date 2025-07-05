import { type NextRequest, NextResponse } from "next/server";
import { getSession, syncUserWithDatabase } from "@/src/lib/supabase-auth";

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isAuthenticated || !session.user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // CRITICAL FIX: Ensure user is synced with database when session is retrieved
    try {
      const syncSuccess = await syncUserWithDatabase(session.user);
      if (!syncSuccess) {
        console.warn(
          "Failed to sync user with database during session retrieval:",
          session.user.email
        );
      }
    } catch (syncError) {
      console.error(
        "Error syncing user with database during session retrieval:",
        syncError
      );
      // Don't block session retrieval for sync errors
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name || session.user.email,
        username: session.user.username,
        image: session.user.picture,
      },
      session: {
        id: session.user.id,
        userId: session.user.id,
        accessToken: session.accessToken,
      },
    });
  } catch (error) {
    console.error("Session API error:", { error: error });
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
