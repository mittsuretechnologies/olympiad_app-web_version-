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
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const uploader = await prisma.uploader.findUnique({ where: { id } });
    if (!uploader) {
      return NextResponse.json({ message: 'Uploader not found' }, { status: 404 });
    }

    const plainPassword = generatePassword(10);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const updated = await prisma.uploader.update({
      where: { id },
      data: { password: hashedPassword, username: uploader.username || uploader.uploaderId },
      select: { id: true, uploaderId: true, name: true, username: true, updatedAt: true },
    });

    return NextResponse.json({ ...updated, password: plainPassword });
  } catch (error) {
    console.error('POST reset uploader failed:', error);
    return NextResponse.json({ message: 'Failed to reset password' }, { status: 500 });
  }
}
