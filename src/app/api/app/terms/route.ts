import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';

// Terms & Conditions gate for AppUser accounts. Mirrors /api/staff/terms for
// Moderator/Evaluator. General (non-Olympiad) signups already collect real
// consent via a checkbox in SignupScreen before calling verify-otp-register,
// which writes termsAccepted: true at creation — those accounts land here
// pre-accepted and the mobile app skips the gate for them. Olympiad accounts
// are provisioned by the school (or self-registered against a school-issued
// code) with no consent step in either flow, so they start at false and this
// is the only place that flips it to true.
//
// GET  -> whether the logged-in user still needs to accept.
// POST -> record acceptance (id captured server-side from the JWT, not the
//         client, so it can't be spoofed).

const JWT_SECRET = getJwtSecret();

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const record = await prisma.appUser.findUnique({
    where: { id: appUser.id },
    select: { termsAccepted: true, termsAcceptedAt: true },
  });
  if (!record) return NextResponse.json({ message: 'Account not found' }, { status: 404 });

  return NextResponse.json({
    termsAccepted: record.termsAccepted,
    termsAcceptedAt: record.termsAcceptedAt,
  });
}

export async function POST(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  await prisma.appUser.update({
    where: { id: appUser.id },
    data: { termsAccepted: true, termsAcceptedAt: now },
  });

  return NextResponse.json({ termsAccepted: true, termsAcceptedAt: now });
}
