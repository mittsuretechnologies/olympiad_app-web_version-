import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { computeOlympiadSlots } from '@/lib/olympiadSlots';
import { loadCategoriesSafe } from '@/lib/uploadCategories';
import { getJwtSecret } from '@/lib/jwt-secret';

const JWT_SECRET = getJwtSecret();

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

// Returns how many olympiad evaluation videos this user has uploaded per category slot.
export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // The student may also exist as a web Student under the same Olympiad ID; a
    // video the school uploaded for that record fills the same slot.
    const me = await prisma.appUser.findUnique({ where: { id: appUser.id }, select: { olympiadId: true } });
    const webStudent = me?.olympiadId
      ? await prisma.student.findUnique({ where: { olympiadCode: me.olympiadId }, select: { id: true } })
      : null;

    const [videos, user] = await Promise.all([
      prisma.video.findMany({
        // No deletedAt filter here — an evaluated video must keep locking its slot even if
        // it was later soft-deleted (e.g. an admin removing a reported video), so we need to
        // see soft-deleted rows too. Non-evaluated videos are filtered by deletedAt below.
        where: { OR: [{ appUserId: appUser.id }, ...(webStudent ? [{ studentId: webStudent.id }] : [])], isEvaluation: true },
        select: { category: true, subCategory: true, status: true, deletedAt: true, evaluations: { select: { id: true } } },
      }),
      prisma.appUser.findUnique({
        where: { id: appUser.id },
        select: { olympiadId: true },
      }),
    ]);

    // A slot is "used" if there's a non-rejected, non-deleted video still on record, OR
    // if ANY video ever assigned to it (even one later soft-deleted) has marks assigned.
    // Deleting an un-evaluated video frees the slot; once an evaluator has submitted marks
    // the slot is locked forever — whether the student tries to delete it (blocked outright,
    // see DELETE /api/app/videos/:id) or an admin removes it via the reported-videos queue
    // (soft-delete succeeds, but the slot must not reopen).
    // The one slot rule (lib/olympiadSlots), with the slot categories' options
    // from dashboard → Upload Categories.
    const {
      slotA: usedA, slotB: usedB, lockedA, lockedB, rejectedA, rejectedB,
    } = computeOlympiadSlots(videos, await loadCategoriesSafe());

    // Fetch school via the olympiadId → allocation → school chain
    let schoolName: string | null = null;
    let state:      string | null = null;
    let district:   string | null = null;
    let classCode:  string | null = null;
    let className:  string | null = null;

    if (user?.olympiadId) {
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where: { code: user.olympiadId },
        select: {
          classCode: true,
          className: true,
          school: { select: { name: true, state: true, district: true } },
        },
      });
      schoolName = allocation?.school?.name     ?? null;
      state      = allocation?.school?.state    ?? null;
      district   = allocation?.school?.district ?? null;
      classCode  = allocation?.classCode        ?? null;
      className  = allocation?.className        ?? null;
    }

    return NextResponse.json({
      slotA: usedA,
      slotB: usedB,
      lockedA,
      lockedB,
      rejectedA,
      rejectedB,
      olympiadId: user?.olympiadId ?? null,
      schoolName,
      state,
      district,
      classCode,
      className,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
