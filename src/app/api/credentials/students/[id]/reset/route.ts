import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, olympiadCode: true },
    });

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const plainPassword = generatePassword(10);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const updated = await prisma.student.update({
      where: { id },
      data: {
        password: hashedPassword,
        plainPassword: plainPassword,
      },
      select: {
        id: true,
        olympiadCode: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ...updated,
      password: plainPassword,
    });
  } catch (error: any) {
    console.error('POST credentials/students/[id]/reset failed:', error);
    return NextResponse.json(
      { message: 'Failed to reset password', error: error?.message },
      { status: 500 }
    );
  }
}
