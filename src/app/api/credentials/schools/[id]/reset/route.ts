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

    const school = await prisma.school.findUnique({
      where: { id },
      select: { id: true, schoolId: true, name: true, username: true },
    });

    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    if (action === 'username') {
      const newUsername: string = (body?.username || '').trim();
      if (!newUsername) {
        return NextResponse.json({ message: 'Username is required' }, { status: 400 });
      }
      if (newUsername.length > 10) {
        return NextResponse.json({ message: 'Username must be max 10 characters' }, { status: 400 });
      }
      // Check uniqueness (exclude self)
      const existing = await prisma.school.findFirst({
        where: { username: newUsername, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json({ message: 'Username already taken by another school' }, { status: 409 });
      }
      const updated = await prisma.school.update({
        where: { id },
        data: { username: newUsername },
        select: { id: true, schoolId: true, username: true, updatedAt: true },
      });
      return NextResponse.json({ ...updated, action: 'username' });
    }

    // action === 'password'
    const customPassword: string | undefined = body?.password?.trim() || undefined;
    const plainPassword = customPassword || generatePassword(10);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const updated = await prisma.school.update({
      where: { id },
      data: { password: hashedPassword, plainPassword },
      select: { id: true, schoolId: true, username: true, updatedAt: true },
    });

    return NextResponse.json({ ...updated, password: plainPassword, action: 'password' });
  } catch (error) {
    console.error('POST credentials/schools/[id]/reset failed:', error);
    return NextResponse.json({ message: 'Failed to update credentials' }, { status: 500 });
  }
}
