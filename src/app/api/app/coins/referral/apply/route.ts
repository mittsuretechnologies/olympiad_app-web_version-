import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAppUser, rateLimited } from '@/lib/coins/appAuth';
import { APPLY_WINDOW_MS, attachReferral, REFERRAL_MESSAGES } from '@/lib/coins/referral';

export const dynamic = 'force-dynamic';

// A friend's invite code, entered after signup (for users whose signup missed
// it). Same rules as at signup, and only within a week of creating the account.
export async function POST(request: Request) {
  const { userId, error } = requireAppUser(request);
  if (error) return error;
  if (rateLimited(`refapply:${userId}`, 5, 60_000)) {
    return NextResponse.json({ message: 'Too many tries. Please wait a minute.' }, { status: 429 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const me = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { mobile: true, createdAt: true, referredById: true, accountType: true },
    });
    if (!me || me.accountType !== 'USER') return NextResponse.json({ message: 'Not available for this account.' }, { status: 403 });
    if (me.referredById) return NextResponse.json({ message: "You've already used an invite code." }, { status: 409 });
    if (Date.now() - me.createdAt.getTime() > APPLY_WINDOW_MS) {
      return NextResponse.json({ message: 'Invite codes can only be added within 7 days of signing up.' }, { status: 409 });
    }
    const result = await attachReferral({
      refereeId: userId,
      code: body?.code,
      deviceId: body?.deviceId,
      mobile: me.mobile,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
    if (!result.attached) {
      return NextResponse.json({ message: REFERRAL_MESSAGES[result.reason ?? 'ERROR'] ?? REFERRAL_MESSAGES.ERROR }, { status: 400 });
    }
    return NextResponse.json({ attached: true });
  } catch (e) {
    console.error('[coins] referral apply', e);
    return NextResponse.json({ message: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
