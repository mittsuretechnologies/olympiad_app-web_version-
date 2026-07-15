import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const viewers = await prisma.viewer.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id:        true,
        email:     true,
        name:      true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(viewers);
  } catch (error: any) {
    console.error('GET credentials/viewers failed:', error);
    return NextResponse.json({ message: 'Failed to fetch', error: error?.message }, { status: 500 });
  }
}
