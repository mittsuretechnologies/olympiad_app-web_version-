import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateUserId } from '@/lib/generateUserId';
import { sendStudentCredentialsEmail } from '@/lib/mailer';

/** Mirrors the generator used by the bulk allot route so both paths produce
 *  the same shape of password. Excludes look-alike characters (l/1/o/0). */
function generatePassword(len = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

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
    // Password is optional: the school panel allots without asking for one and
    // lets the server generate it. If a caller does send one, it must be valid.
    if (password != null && password.trim() && password.trim().length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }
    const finalPassword = password?.trim() || generatePassword();

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

    const school = await prisma.school.findUnique({ where: { id: payload.id }, select: { name: true } });

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

    const passwordHash = await bcrypt.hash(finalPassword, 10);

    // Create AppUser — same structure as app self-registration
    const appUser = await prisma.appUser.create({
      data: {
        userId,
        mobile: mobileNormalized,
        email: emailNormalized,
        password: passwordHash,
        plainPassword: finalPassword,
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
          schoolName: school?.name,
          olympiadCode: code,
          userId: appUser.userId,
          password: finalPassword,
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
      // Returned so the panel can show the generated password once — the
      // school has to be able to pass it on when no email was provided.
      password: finalPassword,
      message: 'Student registered successfully',
      emailSent,
      emailError,
    }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ message: 'Olympiad ID already in use' }, { status: 409 });
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
