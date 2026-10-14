import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isEmail, normaliseMobile } from '@/lib/agreements/server';

export const dynamic = 'force-dynamic';

// POST /api/app/school-signup/check  { mobile, email }
// Called by the app before it asks for an OTP, so a school that is already
// registered is told so up front instead of after a billed SMS.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const mobile = normaliseMobile(body?.mobile);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!mobile) return NextResponse.json({ message: 'A valid 10-digit mobile number is required' }, { status: 400 });
  if (!isEmail(email)) return NextResponse.json({ message: 'A valid email address is required' }, { status: 400 });

  const existing = await prisma.generalSchool.findFirst({
    where: { OR: [{ mobile }, { email: { equals: email, mode: 'insensitive' } }] },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { message: 'A school is already registered with this mobile number or email. Please log in instead.' },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
