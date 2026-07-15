import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action: 'password' | 'username' = body?.action || 'password';
    const source: 'web' | 'app' = body?.source === 'app' ? 'app' : 'web';

    if (source === 'app') {
      const appUser = await prisma.appUser.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });
      if (!appUser) {
        return NextResponse.json({ message: 'Student not found' }, { status: 404 });
      }

      if (action === 'username') {
        const newUserId: string = (body?.username || '').trim();
        if (!newUserId) return NextResponse.json({ message: 'Username is required' }, { status: 400 });
        const existing = await prisma.appUser.findFirst({
          where: { userId: newUserId, id: { not: id } },
        });
        if (existing) return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
        const updated = await prisma.appUser.update({
          where: { id },
          data: { userId: newUserId },
          select: { id: true, userId: true, updatedAt: true },
        });
        return NextResponse.json({ ...updated, action: 'username' });
      }

      // password
      const customPassword: string | undefined = body?.password?.trim() || undefined;
      const plainPassword = customPassword || generatePassword(10);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      const updated = await prisma.appUser.update({
        where: { id },
        data: { password: hashedPassword, plainPassword },
        select: { id: true, updatedAt: true },
      });

      return NextResponse.json({ ...updated, password: plainPassword, action: 'password' });
    }

    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, olympiadCode: true, username: true },
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    if (action === 'username') {
      const newUsername: string = (body?.username || '').trim();
      if (!newUsername) return NextResponse.json({ message: 'Username is required' }, { status: 400 });
      const existing = await prisma.student.findFirst({
        where: { username: newUsername, id: { not: id } },
      });
      if (existing) return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
      const updated = await prisma.student.update({
        where: { id },
        data: { username: newUsername },
        select: { id: true, olympiadCode: true, username: true, updatedAt: true },
      });
      return NextResponse.json({ ...updated, action: 'username' });
    }

    // password
    const customPassword: string | undefined = body?.password?.trim() || undefined;
    const plainPassword = customPassword || generatePassword(10);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const updated = await prisma.student.update({
      where: { id },
      data: { password: hashedPassword, plainPassword },
      select: { id: true, olympiadCode: true, updatedAt: true },
    });

    return NextResponse.json({ ...updated, password: plainPassword, action: 'password' });
  } catch (error: any) {
    console.error('POST credentials/students/[id]/reset failed:', error);
    return NextResponse.json(
      { message: 'Failed to reset', error: error?.message },
      { status: 500 }
    );
  }
}
