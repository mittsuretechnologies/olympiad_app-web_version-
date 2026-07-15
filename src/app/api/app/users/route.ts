import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const users = await prisma.appUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        email: true,
        mobile: true,
        olympiadId: true,
        isVerified: true,
        termsAccepted: true,
        plainPassword: true,
        createdAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('app-users GET error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
