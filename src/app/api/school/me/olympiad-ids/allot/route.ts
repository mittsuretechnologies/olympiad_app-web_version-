import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateUserId } from '@/lib/generateUserId';

function generatePassword(len = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function POST(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try { payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret'); }
    catch { return NextResponse.json({ message: 'Invalid token' }, { status: 401 }); }
    if (payload?.role !== 'SCHOOL' || !payload?.id)
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const { name, phone, classCode } = await request.json();

    if (!name?.trim()) return NextResponse.json({ message: 'Student name is required' }, { status: 400 });
    if (!phone?.trim() || phone.trim().length < 10) return NextResponse.json({ message: 'Valid phone number is required' }, { status: 400 });
    if (!classCode?.trim()) return NextResponse.json({ message: 'Class is required' }, { status: 400 });

    const mobileNormalized = phone.trim().replace(/\D/g, '');

    // Find the next unassigned Olympiad ID for this class
    const available = await prisma.olympiadIdAllocation.findFirst({
      where: {
        schoolId: payload.id,
        classCode,
        sentAt: { not: null },
        assignedName: null,
        student: null,
      },
      orderBy: [{ prefix: 'asc' }, { sequence: 'asc' }],
    });

    if (!available) {
      return NextResponse.json({ message: 'No unassigned Olympiad IDs left for this class' }, { status: 409 });
    }

    const userId = await generateUserId(name.trim());
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const appUser = await prisma.appUser.create({
      data: {
        userId,
        mobile: mobileNormalized,
        password: passwordHash,
        plainPassword,
        isVerified: true,
        termsAccepted: true,
        olympiadId: available.code,
      },
    });

    await prisma.olympiadIdAllocation.update({
      where: { code: available.code },
      data: { assignedName: name.trim(), assignedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      code: available.code,
      userId: appUser.userId,
      password: plainPassword,
    }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ message: 'Olympiad ID already in use' }, { status: 409 });
    console.error('POST allot failed:', error);
    return NextResponse.json({ message: error.message || 'Failed to allot' }, { status: 500 });
  }
}
