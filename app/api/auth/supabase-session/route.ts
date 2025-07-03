import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/lib/supabase-auth";

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isAuthenticated || !session.user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        username: session.user.username,
        image: session.user.picture,
        emailVerified: session.user.emailVerified,
      },
      session: {
        id: session.user.id,
        userId: session.user.id,
        accessToken: session.accessToken,
      },
    });
  } catch (error) {
    console.error("Supabase session API error:", { error });
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
