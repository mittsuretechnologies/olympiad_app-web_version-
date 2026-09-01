import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// GET /api/app/schools/states
// States that actually have at least one active registered school. The picker
// must never offer a state that dead-ends in an empty district list, so this is
// derived from the School table rather than from the full India states list.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  try {
    const rows = await prisma.school.findMany({
      where:  { isActive: true, state: { not: null } },
      select: { state: true },
      distinct: ['state'],
    });

    const states = rows
      .map(r => (r.state || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ states });
  } catch (err) {
    console.error('GET /api/app/schools/states failed:', err);
    return NextResponse.json({ message: 'Failed to fetch states' }, { status: 500 });
  }
}
