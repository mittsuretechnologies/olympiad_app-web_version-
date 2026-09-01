import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// GET /api/app/schools/districts?state=<state name>
// Districts of that state that have at least one active registered school.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  const state = new URL(request.url).searchParams.get('state')?.trim();
  if (!state) {
    return NextResponse.json({ message: 'state is required' }, { status: 400 });
  }

  try {
    const rows = await prisma.school.findMany({
      where:  { isActive: true, state, district: { not: null } },
      select: { district: true },
      distinct: ['district'],
    });

    const districts = rows
      .map(r => (r.district || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ districts });
  } catch (err) {
    console.error('GET /api/app/schools/districts failed:', err);
    return NextResponse.json({ message: 'Failed to fetch districts' }, { status: 500 });
  }
}
