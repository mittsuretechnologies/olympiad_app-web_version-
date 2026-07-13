import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
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
    const { email } = await request.json().catch(() => ({}));

    const allocation = await prisma.olympiadIdAllocation.findUnique({ where: { code } });
    if (!allocation) return NextResponse.json({ message: 'Olympiad ID not found' }, { status: 404 });
    if (allocation.schoolId !== payload.id) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const appUser = await prisma.appUser.findFirst({ where: { olympiadId: code } });
    if (!appUser) return NextResponse.json({ message: 'No app account linked to this student' }, { status: 404 });
    if (!appUser.plainPassword) return NextResponse.json({ message: 'Password unavailable — ask the student to reset it' }, { status: 409 });

    const emailNormalized = (email?.trim() || appUser.email?.trim() || '').toLowerCase();
    if (!emailNormalized) return NextResponse.json({ message: 'No email on file — enter an email to send credentials' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      return NextResponse.json({ message: 'Invalid email address' }, { status: 400 });
    }

    // Save the email on the account if it wasn't already set (or was just supplied fresh).
    if (emailNormalized !== appUser.email?.trim().toLowerCase()) {
      await prisma.appUser.update({ where: { id: appUser.id }, data: { email: emailNormalized } });
    }

    await sendStudentCredentialsEmail({
      to: emailNormalized,
      studentName: allocation.assignedName || appUser.userId,
      olympiadCode: code,
      userId: appUser.userId,
      password: appUser.plainPassword,
    });

    return NextResponse.json({ success: true, email: emailNormalized });
  } catch (error: any) {
    console.error('POST send-credentials failed:', error);
    return NextResponse.json({ message: error.message || 'Failed to send credentials' }, { status: 500 });
  }
}
