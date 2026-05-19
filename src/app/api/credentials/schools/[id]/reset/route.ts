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

    const school = await prisma.school.findUnique({
      where: { id },
      select: { id: true, schoolId: true, username: true },
    });

    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    const plainPassword = generatePassword(10);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const updated = await prisma.school.update({
      where: { id },
      data: {
        password: hashedPassword,
        plainPassword: plainPassword,
        username: school.username || school.schoolId,
      },
      select: {
        id: true,
        schoolId: true,
        username: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ...updated,
      password: plainPassword,
    });
  } catch (error) {
    console.error('POST credentials/schools/[id]/reset failed:', error);
    return NextResponse.json({ message: 'Failed to reset password' }, { status: 500 });
  }
}
