import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// POST /api/app/push-token   { token, platform }  — this phone can get pushes
// DELETE /api/app/push-token { token }            — stop (called on logout)
//
// A token identifies a phone, not a person. Registering moves it to whoever
// is logged in now, so a phone handed to someone else (or a sibling account
// on the same phone) only gets the current account's notifications.

const MAX_TOKEN_LEN = 4096;

export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['APP_USER']);
  if (error) return error;

  try {
    const body = await request.json();
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const platform = body.platform === 'ios' ? 'ios' : 'android';
    if (!token || token.length > MAX_TOKEN_LEN) {
      return NextResponse.json({ message: 'A valid token is required' }, { status: 400 });
    }

    const user = await prisma.appUser.findUnique({ where: { id: payload!.id }, select: { id: true } });
    if (!user) return NextResponse.json({ message: 'Account not found' }, { status: 404 });

    await prisma.pushToken.upsert({
      where: { token },
      update: { appUserId: user.id, platform },
      create: { token, appUserId: user.id, platform },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('push-token register error:', e);
    return NextResponse.json({ message: 'Could not register this device' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { error, payload } = requireRole(request, ['APP_USER']);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token) return NextResponse.json({ message: 'token is required' }, { status: 400 });

    // Only the account the token belongs to can remove it.
    await prisma.pushToken.deleteMany({ where: { token, appUserId: payload!.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('push-token delete error:', e);
    return NextResponse.json({ message: 'Could not unregister this device' }, { status: 500 });
  }
}
