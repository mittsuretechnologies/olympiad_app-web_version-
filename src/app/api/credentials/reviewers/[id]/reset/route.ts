import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const { password } = await request.json();

    const newPassword = password?.trim() || Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.reviewer.update({
      where: { id },
      data: { password: hash, plainPassword: newPassword },
    });

    return NextResponse.json({ success: true, plainPassword: newPassword });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
