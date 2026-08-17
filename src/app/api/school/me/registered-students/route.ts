import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL } from '@/lib/olympiad-categories';

/** One evaluation-slot's worth of state for a student's directory row. */
type SlotInfo = {
  status: 'empty' | 'pending' | 'approved' | 'rejected';
  subCategory: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

function emptySlot(): SlotInfo {
  return { status: 'empty', subCategory: null, videoUrl: null, thumbnailUrl: null };
}

/**
 * Reduces a student's evaluation videos (both categories, any number of
 * re-uploads after rejection) down to "what does slot A/B look like right
 * now" — the same precedence the upload page itself uses: an approved or
 * pending entry wins over an older rejected one, since a re-upload replaces
 * the slot rather than adding to it.
 */
function resolveSlots(videos: { category: string | null; status: string; subCategory: string | null; videoUrl: string; thumbnailUrl: string | null }[]) {
  const forCategory = (label: string): SlotInfo => {
    const matches = videos.filter(v => v.category === label || v.category === (label === OLYMPIAD_CAT_A_LABEL ? 'Cat A' : 'Cat B'));
    if (matches.length === 0) return emptySlot();
    const live = matches.find(v => v.status === 'APPROVED') || matches.find(v => v.status === 'PENDING');
    const chosen = live || matches[matches.length - 1];
    const status = chosen.status === 'APPROVED' ? 'approved' : chosen.status === 'PENDING' ? 'pending' : 'rejected';
    return { status, subCategory: chosen.subCategory, videoUrl: chosen.videoUrl, thumbnailUrl: chosen.thumbnailUrl };
  };
  return { slotA: forCategory(OLYMPIAD_CAT_A_LABEL), slotB: forCategory(OLYMPIAD_CAT_B_LABEL) };
}

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    } catch {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    if (payload?.role !== 'SCHOOL' || !payload?.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Fetch all sent allocations for this school
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: payload.id, sentAt: { not: null } },
      select: { code: true, classCode: true, className: true, assignedName: true },
    });
    const codes = allocations.map(a => a.code);
    const allocationByCode = new Map(allocations.map(a => [a.code, a]));

    // Web-registered students (Student table)
    const webStudents = await prisma.student.findMany({
      where: { allocation: { schoolId: payload.id }, isVerified: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, phone: true, olympiadCode: true,
        isVerified: true, createdAt: true,
        allocation: { select: { classCode: true, className: true } },
      },
    });
    const webCodes = new Set(webStudents.map(s => s.olympiadCode));

    // App-registered users (AppUser table) — only those not already in Student table
    const appUsers = await prisma.appUser.findMany({
      where: { olympiadId: { in: codes }, isVerified: true },
      select: {
        id: true, userId: true, mobile: true, email: true, olympiadId: true,
        isVerified: true, createdAt: true, plainPassword: true,
      },
    });

    const webStudentIds = webStudents.map(s => s.id);
    const appUserIds    = appUsers.filter(u => !webCodes.has(u.olympiadId!)).map(u => u.id);

    // Full evaluation-video rows (not just counts) — the directory needs to
    // show *what* each slot contains, not just how many videos exist.
    const [webVideos, appVideos] = await Promise.all([
      prisma.video.findMany({
        where: { studentId: { in: webStudentIds }, isEvaluation: true, deletedAt: null },
        select: { studentId: true, category: true, subCategory: true, status: true, videoUrl: true, thumbnailUrl: true },
      }),
      prisma.video.findMany({
        where: { appUserId: { in: appUserIds }, isEvaluation: true, deletedAt: null },
        select: { appUserId: true, category: true, subCategory: true, status: true, videoUrl: true, thumbnailUrl: true },
      }),
    ]);

    const webVideosById = new Map<string, typeof webVideos>();
    for (const v of webVideos) {
      if (!v.studentId) continue;
      (webVideosById.get(v.studentId) ?? webVideosById.set(v.studentId, []).get(v.studentId)!).push(v);
    }
    const appVideosById = new Map<string, typeof appVideos>();
    for (const v of appVideos) {
      if (!v.appUserId) continue;
      (appVideosById.get(v.appUserId) ?? appVideosById.set(v.appUserId, []).get(v.appUserId)!).push(v);
    }

    const result = [
      ...webStudents.map(s => {
        const slots = resolveSlots(webVideosById.get(s.id) ?? []);
        return {
          id: s.id,
          name: s.name,
          phone: s.phone,
          olympiadCode: s.olympiadCode,
          isVerified: s.isVerified,
          createdAt: s.createdAt,
          classCode: s.allocation?.classCode || null,
          className: s.allocation?.className || null,
          source: 'web' as const,
          olympiadVideos: (slots.slotA.status === 'approved' ? 1 : 0) + (slots.slotB.status === 'approved' ? 1 : 0),
          email: null as string | null,
          username: null as string | null,
          password: null as string | null,
          slotA: slots.slotA,
          slotB: slots.slotB,
        };
      }),
      ...appUsers
        .filter(u => !webCodes.has(u.olympiadId!))
        .map(u => {
          const alloc = allocationByCode.get(u.olympiadId!);
          const slots = resolveSlots(appVideosById.get(u.id) ?? []);
          return {
            id: u.id,
            name: (allocationByCode.get(u.olympiadId!) as any)?.assignedName || u.userId,
            phone: u.mobile || '-',
            olympiadCode: u.olympiadId!,
            isVerified: u.isVerified,
            createdAt: u.createdAt,
            classCode: alloc?.classCode || null,
            className: alloc?.className || null,
            source: 'app' as const,
            olympiadVideos: (slots.slotA.status === 'approved' ? 1 : 0) + (slots.slotB.status === 'approved' ? 1 : 0),
            email: u.email || null,
            username: u.userId,
            password: u.plainPassword,
            slotA: slots.slotA,
            slotB: slots.slotB,
          };
        }),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET school registered-students failed:', error);
    return NextResponse.json({ message: 'Failed to fetch students' }, { status: 500 });
  }
}
