import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  let out = '';
  for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action: 'password' | 'username' = body?.action || 'password';

    const uploader = await prisma.uploader.findUnique({ where: { id } });
    if (!uploader) {
      return NextResponse.json({ message: 'Uploader not found' }, { status: 404 });
    }

    if (action === 'username') {
      const newUsername: string = (body?.username || '').trim();
      if (!newUsername) return NextResponse.json({ message: 'Username is required' }, { status: 400 });
      const existing = await prisma.uploader.findFirst({
        where: { username: newUsername, id: { not: id } },
      });
      if (existing) return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
      const updated = await prisma.uploader.update({
        where: { id },
        data: { username: newUsername },
        select: { id: true, uploaderId: true, username: true, updatedAt: true },
      });
      return NextResponse.json({ ...updated, action: 'username' });
    }

    // password
    const customPassword: string | undefined = body?.password?.trim() || undefined;
    const plainPassword = customPassword || generatePassword(10);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const updated = await prisma.uploader.update({
      where: { id },
      data: { password: hashedPassword, plainPassword },
      select: { id: true, uploaderId: true, name: true, username: true, updatedAt: true },
    });

    return NextResponse.json({ ...updated, password: plainPassword, action: 'password' });
  } catch (error) {
    console.error('POST reset uploader failed:', error);
    return NextResponse.json({ message: 'Failed to reset' }, { status: 500 });
  }
}
