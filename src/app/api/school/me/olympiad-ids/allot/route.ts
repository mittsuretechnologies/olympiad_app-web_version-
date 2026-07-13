import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateUserId } from '@/lib/generateUserId';
import { sendStudentCredentialsEmail } from '@/lib/mailer';

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

    const { name, phone, classCode, email } = await request.json();

    if (!name?.trim()) return NextResponse.json({ message: 'Student name is required' }, { status: 400 });
    if (!phone?.trim() || phone.trim().length < 10) return NextResponse.json({ message: 'Valid phone number is required' }, { status: 400 });
    if (!classCode?.trim()) return NextResponse.json({ message: 'Class is required' }, { status: 400 });

    const emailNormalized = email?.trim().toLowerCase() || null;
    if (emailNormalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      return NextResponse.json({ message: 'Invalid email address' }, { status: 400 });
    }

    const mobileNormalized = phone.trim().replace(/\D/g, '');

    if (emailNormalized) {
      const existingEmail = await prisma.appUser.findFirst({ where: { email: emailNormalized } });
      if (existingEmail) return NextResponse.json({ message: 'This email is already registered on the app' }, { status: 409 });
    }

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
        email: emailNormalized,
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

    // Email the credentials to the student (best-effort — a mail failure
    // must not roll back a successful allotment).
    let emailSent = false;
    let emailError: string | null = null;
    if (emailNormalized) {
      try {
        await sendStudentCredentialsEmail({
          to: emailNormalized,
          studentName: name.trim(),
          olympiadCode: available.code,
          userId: appUser.userId,
          password: plainPassword,
        });
        emailSent = true;
      } catch (mailErr: any) {
        emailError = mailErr?.message || 'Failed to send email';
        console.error(`Student credential email to ${emailNormalized} failed:`, mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      code: available.code,
      userId: appUser.userId,
      password: plainPassword,
      emailSent,
      emailError,
    }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ message: 'Olympiad ID already in use' }, { status: 409 });
    console.error('POST allot failed:', error);
    return NextResponse.json({ message: error.message || 'Failed to allot' }, { status: 500 });
  }
}
