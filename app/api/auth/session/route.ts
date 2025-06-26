import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/src/lib/kinde-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isAuthenticated || !session.user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.given_name && session.user.family_name 
          ? `${session.user.given_name} ${session.user.family_name}`
          : session.user.email,
        username: session.user.username,
        image: session.user.picture,
      },
      session: {
        id: session.user.id,
        userId: session.user.id,
      }
    });
  } catch (error) {
    console.error("Session API error:", { error: error });
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
