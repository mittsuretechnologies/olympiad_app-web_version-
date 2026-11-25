import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/school-notifications/schools?q= — recipient picker for the
// compose form: how many active schools there are, the states they are in
// (with a count each), and up to 15 schools matching q.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'schools.view');
  if (error) return error;
  try {
    const q = (new URL(request.url).searchParams.get('q') || '').trim();
    const [total, byState, schools] = await Promise.all([
      prisma.school.count({ where: { isActive: true } }),
      prisma.school.groupBy({
        by: ['state'],
        where: { isActive: true, state: { not: null } },
        _count: { _all: true },
        orderBy: { state: 'asc' },
      }),
      q
        ? prisma.school.findMany({
            where: { isActive: true, OR: [{ name: { contains: q, mode: 'insensitive' } }, { schoolId: { contains: q, mode: 'insensitive' } }] },
            select: { schoolId: true, name: true, city: true, state: true },
            orderBy: { name: 'asc' },
            take: 15,
          })
        : Promise.resolve([]),
    ]);
    const states = byState
      .filter(s => s.state && s.state.trim())
      .map(s => ({ state: s.state as string, count: s._count._all }));
    return NextResponse.json({ total, states, schools });
  } catch (err) {
    console.error('GET school-notifications/schools failed:', err);
    return NextResponse.json({ message: 'Failed to load schools' }, { status: 500 });
  }
}
