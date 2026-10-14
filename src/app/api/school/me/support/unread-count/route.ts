import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// GET -> how many of this school's requests have a team reply it hasn't
// opened yet. Drives the badge on the "Help & Support" sidebar item.
export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  try {
    const unread = await prisma.schoolSupportTicket.count({ where: { schoolId: payload.id, unreadBySchool: true } });
    return NextResponse.json({ unread });
  } catch (err) {
    console.error('GET school/me/support/unread-count failed:', err);
    return NextResponse.json({ unread: 0 });
  }
}
