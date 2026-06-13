import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Live counts for the SuperAdmin dashboard cards.
 *
 * Previously the dashboard showed hardcoded zeros. This reads real counts from the
 * shared database (the same one the olympiad-checker reads).
 *
 * Notes:
 *  - "Active Olympiads" and "Revenue" have no model in this schema yet, so they are
 *    returned as null and the UI shows them as not-tracked rather than a fake number.
 */
export async function GET() {
  try {
    const [schools, students] = await Promise.all([
      prisma.school.count(),
      prisma.student.count(),
    ]);

    return NextResponse.json({
      registeredSchools: schools,
      totalStudents: students,
      activeOlympiads: null, // no Olympiad/Exam model in this DB yet
      revenue: null,         // not tracked in this DB yet
    });
  } catch (error) {
    console.error('GET /api/dashboard/stats failed:', error);
    return NextResponse.json(
      { message: 'Failed to load dashboard stats' },
      { status: 500 },
    );
  }
}
