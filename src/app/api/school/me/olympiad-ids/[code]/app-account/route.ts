import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try { payload = jwt.verify(token, getJwtSecret()); }
    catch { return NextResponse.json({ message: 'Invalid token' }, { status: 401 }); }
    if (payload?.role !== 'SCHOOL' || !payload?.id)
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const { code } = await params;
    const { name, phone, email } = await request.json();

    if (!name?.trim()) return NextResponse.json({ message: 'Student name is required' }, { status: 400 });
    if (!phone?.trim() || phone.trim().length < 10) return NextResponse.json({ message: 'Valid phone number is required' }, { status: 400 });

    // Required, matching the Allot Student form — students allotted before email
    // became mandatory get one added the first time their details are edited.
    const emailNormalized = email?.trim().toLowerCase() || '';
    if (!emailNormalized) return NextResponse.json({ message: 'Email address is required' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      return NextResponse.json({ message: 'Invalid email address' }, { status: 400 });
    }

    const allocation = await prisma.olympiadIdAllocation.findUnique({ where: { code } });
    if (!allocation) return NextResponse.json({ message: 'Olympiad ID not found' }, { status: 404 });
    if (allocation.schoolId !== payload.id) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const appUser = await prisma.appUser.findFirst({ where: { olympiadId: code } });
    if (!appUser) return NextResponse.json({ message: 'No app account linked to this ID' }, { status: 404 });

    // Same uniqueness rule as allotment, but the student's own current address
    // doesn't count as a clash.
    const emailOwner = await prisma.appUser.findFirst({
      where: { email: emailNormalized, NOT: { id: appUser.id } },
      select: { id: true },
    });
    if (emailOwner) return NextResponse.json({ message: 'This email is already registered on the app' }, { status: 409 });

    const mobileNormalized = phone.trim().replace(/\D/g, '');

    await prisma.appUser.update({
      where: { id: appUser.id },
      data: { mobile: mobileNormalized, email: emailNormalized },
    });

    await prisma.olympiadIdAllocation.update({
      where: { code },
      data: { assignedName: name.trim() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ message: 'This value is already in use' }, { status: 409 });
    console.error('PATCH app-account failed:', error);
    return NextResponse.json({ message: error.message || 'Failed to update' }, { status: 500 });
  }
}
