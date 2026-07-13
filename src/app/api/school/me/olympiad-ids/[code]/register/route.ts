import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateUserId } from '@/lib/generateUserId';
import { sendStudentCredentialsEmail } from '@/lib/mailer';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try { payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret'); }
    catch { return NextResponse.json({ message: 'Invalid token' }, { status: 401 }); }
    if (payload?.role !== 'SCHOOL' || !payload?.id)
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const { code } = await params;
    const { name, phone, password, email } = await request.json();

    if (!name?.trim()) return NextResponse.json({ message: 'Student name is required' }, { status: 400 });
    if (!phone?.trim() || phone.trim().length < 10) return NextResponse.json({ message: 'Valid phone number is required' }, { status: 400 });
    if (!password?.trim() || password.trim().length < 6) return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });

    const emailNormalized = email?.trim().toLowerCase() || null;
    if (emailNormalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      return NextResponse.json({ message: 'Invalid email address' }, { status: 400 });
    }

    const allocation = await prisma.olympiadIdAllocation.findUnique({
      where: { code },
      include: { student: true },
    });

    if (!allocation) return NextResponse.json({ message: 'Olympiad ID not found' }, { status: 404 });
    if (allocation.schoolId !== payload.id) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    // Check if already registered (web Student or AppUser)
    if (allocation.student) return NextResponse.json({ message: 'Already registered as web student' }, { status: 409 });

    const mobileNormalized = phone.trim().replace(/\D/g, '');

    const existingOlympiadLink = await prisma.appUser.findFirst({ where: { olympiadId: code } });
    if (existingOlympiadLink) return NextResponse.json({ message: 'This Olympiad ID is already linked to an app account' }, { status: 409 });

    if (emailNormalized) {
      const existingEmail = await prisma.appUser.findFirst({ where: { email: emailNormalized } });
      if (existingEmail) return NextResponse.json({ message: 'This email is already registered on the app' }, { status: 409 });
    }

    // Generate userId from student's name → e.g. "Suraj Joshi" → surajjoshi_4f2a
    const userId = await generateUserId(name.trim());

    const passwordHash = await bcrypt.hash(password.trim(), 10);

    // Create AppUser — same structure as app self-registration
    const appUser = await prisma.appUser.create({
      data: {
        userId,
        mobile: mobileNormalized,
        email: emailNormalized,
        password: passwordHash,
        plainPassword: password.trim(),
        isVerified: true,
        termsAccepted: true,
        olympiadId: code,
      },
    });

    // Ensure assignedName is set on allocation
    await prisma.olympiadIdAllocation.update({
      where: { code },
      data: {
        assignedName: name.trim(),
        assignedAt: allocation.assignedAt ?? new Date(),
      },
    });

    // Email the credentials to the student (best-effort — a mail failure
    // must not roll back a successful registration).
    let emailSent = false;
    let emailError: string | null = null;
    if (emailNormalized) {
      try {
        await sendStudentCredentialsEmail({
          to: emailNormalized,
          studentName: name.trim(),
          olympiadCode: code,
          userId: appUser.userId,
          password: password.trim(),
        });
        emailSent = true;
      } catch (mailErr: any) {
        emailError = mailErr?.message || 'Failed to send email';
        console.error(`Student credential email to ${emailNormalized} failed:`, mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      userId: appUser.userId,
      message: 'Student registered successfully',
      emailSent,
      emailError,
    }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ message: 'Olympiad ID already in use' }, { status: 409 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
