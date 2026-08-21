import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// GET /api/app/schools/list?state=<name>&district=<name>&q=<search>
// Active schools in that district — i.e. only schools actually registered on
// Mittmee. Anything not in this list is what the app's "My school is not
// listed" option is for.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const state    = searchParams.get('state')?.trim();
  const district = searchParams.get('district')?.trim();
  const q        = searchParams.get('q')?.trim();

  if (!state || !district) {
    return NextResponse.json({ message: 'state and district are required' }, { status: 400 });
  }

  try {
    const schools = await prisma.school.findMany({
      where: {
        isActive: true,
        state,
        district,
        ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      select: { id: true, schoolId: true, name: true, city: true, district: true, state: true },
      orderBy: { name: 'asc' },
      take: 200,
    });

    return NextResponse.json({ schools });
  } catch (err) {
    console.error('GET /api/app/schools/list failed:', err);
    return NextResponse.json({ message: 'Failed to fetch schools' }, { status: 500 });
  }
}
