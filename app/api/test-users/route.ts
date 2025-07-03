import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/src/db';

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ success: false, error: 'email query parameter required' }, { status: 400 });
  }

  try {
    await db.delete(users).where(eq(users.email, email));
    return NextResponse.json({ success: true, message: `Deleted user with email ${email}` });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 });
  }
}
