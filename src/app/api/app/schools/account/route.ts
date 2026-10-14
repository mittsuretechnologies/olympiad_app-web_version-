import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { ensureSchoolAccount } from '@/lib/schoolAccount';

export const dynamic = 'force-dynamic';

// GET /api/app/schools/account?schoolId=<School.id>
// A school opens in the app as a profile - the profile of its app account. A
// place that only knows the School id (a reel's school tag, the Home screen's
// "videos from your school") asks here for the account id to open. The account
// is created on the spot if the school has never logged in.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  const schoolId = new URL(request.url).searchParams.get('schoolId')?.trim();
  if (!schoolId) return NextResponse.json({ message: 'schoolId is required' }, { status: 400 });

  try {
    const school = await prisma.school.findFirst({
      where: { id: schoolId, isActive: true },
      select: { id: true, username: true, schoolId: true, name: true },
    });
    if (!school) return NextResponse.json({ message: 'School not found' }, { status: 404 });

    const account = await ensureSchoolAccount(school);
    return NextResponse.json({ appUserId: account.id });
  } catch (err) {
    console.error('GET /api/app/schools/account failed:', err);
    return NextResponse.json({ message: 'Failed to open the school' }, { status: 500 });
  }
}
