import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

const SCHOOL_SELECT = {
  id: true, schoolId: true, name: true, city: true, district: true, state: true,
} as const;

/**
 * The user's single school linkage, in one of six states:
 *
 *   OLYMPIAD  - they hold an Olympiad ID, so their school is already fixed by
 *               the allocation. Nothing to request; the section is read-only.
 *   APPROVED  - school approved their request. Their videos now surface on that
 *               school's portal and on its page in the app.
 *   PENDING   - request sent, awaiting the school's decision.
 *   REJECTED  - school declined. They may pick another school, or re-ask.
 *   UNLISTED  - their school is not on Mittmee; they typed the name. This is a
 *               profile label only: no request, no approval, no linkage.
 *   NONE      - nothing set yet.
 */
async function resolveState(appUserId: string) {
  const user = await prisma.appUser.findUnique({
    where:  { id: appUserId },
    select: { olympiadId: true, unlistedSchoolName: true },
  });
  if (!user) return null;

  // An Olympiad ID already pins the user to a school - that linkage wins and
  // cannot be overridden by a request.
  if (user.olympiadId) {
    const allocation = await prisma.olympiadIdAllocation.findUnique({
      where:  { code: user.olympiadId },
      select: { school: { select: SCHOOL_SELECT } },
    });
    if (allocation?.school) {
      return {
        status: 'OLYMPIAD' as const,
        school: allocation.school,
        unlistedSchoolName: null,
        requestedAt: null,
        decidedAt: null,
      };
    }
  }

  const link = await prisma.schoolLinkRequest.findFirst({
    where:   { appUserId },
    orderBy: { updatedAt: 'desc' },
    select:  {
      status: true, createdAt: true, decidedAt: true,
      school: { select: SCHOOL_SELECT },
    },
  });

  if (link && link.status !== 'REJECTED') {
    return {
      status: link.status as 'PENDING' | 'APPROVED',
      school: link.school,
      unlistedSchoolName: null,
      requestedAt: link.createdAt,
      decidedAt: link.decidedAt,
    };
  }

  if (user.unlistedSchoolName) {
    return {
      status: 'UNLISTED' as const,
      school: null,
      unlistedSchoolName: user.unlistedSchoolName,
      requestedAt: null,
      decidedAt: null,
    };
  }

  if (link) {
    return {
      status: 'REJECTED' as const,
      school: link.school,
      unlistedSchoolName: null,
      requestedAt: link.createdAt,
      decidedAt: link.decidedAt,
    };
  }

  return { status: 'NONE' as const, school: null, unlistedSchoolName: null, requestedAt: null, decidedAt: null };
}

// GET /api/app/my-school
export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  try {
    const state = await resolveState(payload.id);
    if (!state) return NextResponse.json({ message: 'User not found' }, { status: 404 });
    return NextResponse.json(state);
  } catch (err) {
    console.error('GET /api/app/my-school failed:', err);
    return NextResponse.json({ message: 'Failed to load school' }, { status: 500 });
  }
}

// POST /api/app/my-school
//   { schoolId }            -> send a link request to a registered school
//   { unlistedSchoolName }  -> record an unregistered school as a plain label
export async function POST(request: Request) {
  const { payload, error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const schoolId           = typeof body.schoolId === 'string' ? body.schoolId.trim() : '';
  const unlistedSchoolName = typeof body.unlistedSchoolName === 'string' ? body.unlistedSchoolName.trim() : '';

  if (!schoolId && !unlistedSchoolName) {
    return NextResponse.json({ message: 'Pick a school or enter your school name' }, { status: 400 });
  }

  try {
    const user = await prisma.appUser.findUnique({
      where:  { id: payload.id },
      select: { olympiadId: true },
    });
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    if (user.olympiadId) {
      return NextResponse.json(
        { message: 'Your school is already set from your Olympiad ID' },
        { status: 409 },
      );
    }

    // Leaving an approved school is an explicit action (DELETE), never a silent
    // side effect of picking a different one - the old school would otherwise
    // lose a student without ever being told.
    const approved = await prisma.schoolLinkRequest.findFirst({
      where:  { appUserId: payload.id, status: 'APPROVED' },
      select: { id: true },
    });
    if (approved) {
      return NextResponse.json(
        { message: 'Leave your current school before choosing another' },
        { status: 409 },
      );
    }

    if (unlistedSchoolName) {
      if (unlistedSchoolName.length > 120) {
        return NextResponse.json({ message: 'School name is too long' }, { status: 400 });
      }
      // Choosing "not listed" withdraws any request still awaiting a decision.
      await prisma.$transaction([
        prisma.schoolLinkRequest.deleteMany({ where: { appUserId: payload.id, status: 'PENDING' } }),
        prisma.appUser.update({ where: { id: payload.id }, data: { unlistedSchoolName } }),
      ]);
      return NextResponse.json(await resolveState(payload.id));
    }

    const school = await prisma.school.findFirst({
      where:  { id: schoolId, isActive: true },
      select: { id: true, name: true },
    });
    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    // One pending request at a time: switching schools replaces the old ask
    // rather than leaving several portals waiting on the same student.
    await prisma.$transaction([
      prisma.schoolLinkRequest.deleteMany({
        where: { appUserId: payload.id, status: 'PENDING', schoolId: { not: school.id } },
      }),
      // A previously rejected row for this same school is flipped back to
      // PENDING - the unique (appUserId, schoolId) index makes this an update.
      prisma.schoolLinkRequest.upsert({
        where:  { appUserId_schoolId: { appUserId: payload.id, schoolId: school.id } },
        create: { appUserId: payload.id, schoolId: school.id, status: 'PENDING' },
        update: { status: 'PENDING', decidedAt: null },
      }),
      // A real request supersedes any free-text school they had typed before.
      prisma.appUser.update({ where: { id: payload.id }, data: { unlistedSchoolName: null } }),
    ]);

    return NextResponse.json(await resolveState(payload.id));
  } catch (err) {
    console.error('POST /api/app/my-school failed:', err);
    return NextResponse.json({ message: 'Failed to send request' }, { status: 500 });
  }
}

// DELETE /api/app/my-school
// Withdraws a pending request, leaves an approved school, clears a rejected
// row, or clears the free-text school name - whichever the user currently has.
export async function DELETE(request: Request) {
  const { payload, error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  try {
    const user = await prisma.appUser.findUnique({
      where:  { id: payload.id },
      select: { olympiadId: true },
    });
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    if (user.olympiadId) {
      return NextResponse.json(
        { message: 'Your school comes from your Olympiad ID and cannot be removed' },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.schoolLinkRequest.deleteMany({ where: { appUserId: payload.id } }),
      prisma.appUser.update({ where: { id: payload.id }, data: { unlistedSchoolName: null } }),
    ]);

    return NextResponse.json(await resolveState(payload.id));
  } catch (err) {
    console.error('DELETE /api/app/my-school failed:', err);
    return NextResponse.json({ message: 'Failed to update school' }, { status: 500 });
  }
}
