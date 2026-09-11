import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { decryptPassword } from '@/lib/password-crypto';

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const uploaders = await prisma.uploader.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        uploaderId: true,
        name: true,
        email: true,
        phone: true,
        username: true,
        plainPassword: true,
        status: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json(
      uploaders.map((u) => ({ ...u, plainPassword: decryptPassword(u.plainPassword) }))
    );
  } catch (error: any) {
    console.error('GET credentials/uploaders failed:', error);
    return NextResponse.json({ message: 'Failed to fetch' }, { status: 500 });
  }
}
