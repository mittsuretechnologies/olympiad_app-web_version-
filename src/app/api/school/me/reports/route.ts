import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL } from '@/lib/olympiad-categories';
import { videoPercent } from '@/lib/kosh';

/**
 * One evaluation slot's full state for a student's report row — everything
 * a school needs to answer "did they upload, is it approved, is it scored,
 * is the result out" for Category A / Category B without opening the video.
 */
type SlotReport = {
  status: 'empty' | 'pending' | 'approved' | 'rejected';
  subCategory: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  rejectionReason: string | null;
  tags: string | null;
  likesCount: number;
  viewsCount: number;
  createdAt: string | null;
  evaluationStatus: 'not_applicable' | 'pending' | 'evaluated' | 'published';
  totalScore: number | null; // 0-20
  percent: number | null;
};

function emptySlot(): SlotReport {
  return {
    status: 'empty', subCategory: null, videoUrl: null, thumbnailUrl: null,
    rejectionReason: null, tags: null, likesCount: 0, viewsCount: 0, createdAt: null,
    evaluationStatus: 'not_applicable', totalScore: null, percent: null,
  };
}

type VideoRow = {
  id: string; category: string | null; subCategory: string | null; status: string;
  videoUrl: string; thumbnailUrl: string | null; rejectionReason: string | null;
  tags: string | null; likesCount: number; viewsCount: number; createdAt: Date;
  evaluation: { totalScore: number; isPublished: boolean } | null;
};

// Same precedence the registered-students directory and the student's own
// upload page use: an approved or pending entry wins over an older rejected
// one, since a re-upload replaces the slot rather than adding to it.
function resolveSlots(videos: VideoRow[]) {
  const forCategory = (label: string): SlotReport => {
    const matches = videos.filter(v => v.category === label || v.category === (label === OLYMPIAD_CAT_A_LABEL ? 'Cat A' : 'Cat B'));
    if (matches.length === 0) return emptySlot();
    const live = matches.find(v => v.status === 'APPROVED') || matches.find(v => v.status === 'PENDING');
    const chosen = live || matches[matches.length - 1];
    const status = chosen.status === 'APPROVED' ? 'approved' : chosen.status === 'PENDING' ? 'pending' : 'rejected';

    let evaluationStatus: SlotReport['evaluationStatus'] = 'not_applicable';
    let totalScore: number | null = null;
    let percent: number | null = null;
    if (status === 'approved') {
      if (!chosen.evaluation) {
        evaluationStatus = 'pending';
      } else {
        evaluationStatus = chosen.evaluation.isPublished ? 'published' : 'evaluated';
        totalScore = chosen.evaluation.totalScore;
        percent = videoPercent(chosen.evaluation.totalScore);
      }
    }

    return {
      status, subCategory: chosen.subCategory, videoUrl: chosen.videoUrl, thumbnailUrl: chosen.thumbnailUrl,
      rejectionReason: chosen.rejectionReason, tags: chosen.tags,
      likesCount: chosen.likesCount, viewsCount: chosen.viewsCount,
      createdAt: chosen.createdAt.toISOString(),
      evaluationStatus, totalScore, percent,
    };
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

    // Every allocation this school has ever had sent out — this is the
    // report's spine. A student who never registered still gets a row.
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: payload.id, sentAt: { not: null } },
      select: { code: true, classCode: true, className: true, assignedName: true, sentAt: true, createdAt: true },
    });
    const codes = allocations.map(a => a.code);
    const allocByCode = new Map(allocations.map(a => [a.code, a]));

    const [webStudents, appUsers] = await Promise.all([
      prisma.student.findMany({
        where: { allocation: { schoolId: payload.id } },
        select: {
          id: true, name: true, phone: true, olympiadCode: true, isVerified: true, createdAt: true,
          allocation: { select: { classCode: true, className: true } },
        },
      }),
      prisma.appUser.findMany({
        where: { olympiadId: { in: codes } },
        select: { id: true, userId: true, mobile: true, email: true, olympiadId: true, isVerified: true, createdAt: true },
      }),
    ]);
    const webCodes = new Set(webStudents.map(s => s.olympiadCode));
    const registeredAppUsers = appUsers.filter(u => !webCodes.has(u.olympiadId!));

    const webStudentIds = webStudents.map(s => s.id);
    const appUserIds = registeredAppUsers.map(u => u.id);

    const [webVideosRaw, appVideosRaw] = await Promise.all([
      prisma.video.findMany({
        where: { studentId: { in: webStudentIds }, isEvaluation: true, deletedAt: null },
        select: {
          id: true, studentId: true, category: true, subCategory: true, status: true, videoUrl: true,
          thumbnailUrl: true, rejectionReason: true, tags: true, likesCount: true, viewsCount: true, createdAt: true,
          evaluations: { select: { totalScore: true, isPublished: true } },
        },
      }),
      prisma.video.findMany({
        where: { appUserId: { in: appUserIds }, isEvaluation: true, deletedAt: null },
        select: {
          id: true, appUserId: true, category: true, subCategory: true, status: true, videoUrl: true,
          thumbnailUrl: true, rejectionReason: true, tags: true, likesCount: true, viewsCount: true, createdAt: true,
          evaluations: { select: { totalScore: true, isPublished: true } },
        },
      }),
    ]);

    const toVideoRow = (v: (typeof webVideosRaw)[number] | (typeof appVideosRaw)[number]): VideoRow => ({
      id: v.id, category: v.category, subCategory: v.subCategory, status: v.status, videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl, rejectionReason: v.rejectionReason, tags: v.tags,
      likesCount: v.likesCount, viewsCount: v.viewsCount, createdAt: v.createdAt,
      evaluation: v.evaluations[0] ? { totalScore: v.evaluations[0].totalScore, isPublished: v.evaluations[0].isPublished } : null,
    });

    const webVideosById = new Map<string, VideoRow[]>();
    for (const v of webVideosRaw) {
      if (!v.studentId) continue;
      (webVideosById.get(v.studentId) ?? webVideosById.set(v.studentId, []).get(v.studentId)!).push(toVideoRow(v));
    }
    const appVideosById = new Map<string, VideoRow[]>();
    for (const v of appVideosRaw) {
      if (!v.appUserId) continue;
      (appVideosById.get(v.appUserId) ?? appVideosById.set(v.appUserId, []).get(v.appUserId)!).push(toVideoRow(v));
    }

    // Rows for allocations that were sent but never registered by anyone —
    // the report has to show "pending" for these, not silently drop them.
    const registeredCodes = new Set([...webStudents.map(s => s.olympiadCode), ...registeredAppUsers.map(u => u.olympiadId!)]);

    type Row = {
      key: string;
      name: string;
      phone: string | null;
      username: string | null;
      olympiadCode: string;
      classCode: string | null;
      className: string | null;
      source: 'web' | 'app' | null;
      registrationStatus: 'registered' | 'pending';
      isVerified: boolean;
      registeredAt: string | null;
      allocatedAt: string;
      slotA: SlotReport;
      slotB: SlotReport;
    };

    const rows: Row[] = [];

    for (const s of webStudents) {
      const { slotA, slotB } = resolveSlots(webVideosById.get(s.id) ?? []);
      rows.push({
        key: s.id, name: s.name, phone: s.phone, username: null, olympiadCode: s.olympiadCode,
        classCode: s.allocation?.classCode || null, className: s.allocation?.className || null,
        source: 'web', registrationStatus: 'registered', isVerified: s.isVerified,
        registeredAt: s.createdAt.toISOString(),
        allocatedAt: (allocByCode.get(s.olympiadCode)?.createdAt || s.createdAt).toISOString(),
        slotA, slotB,
      });
    }

    for (const u of registeredAppUsers) {
      const alloc = allocByCode.get(u.olympiadId!);
      const { slotA, slotB } = resolveSlots(appVideosById.get(u.id) ?? []);
      rows.push({
        key: u.id, name: alloc?.assignedName || u.userId, phone: u.mobile || null, username: u.userId,
        olympiadCode: u.olympiadId!, classCode: alloc?.classCode || null, className: alloc?.className || null,
        source: 'app', registrationStatus: 'registered', isVerified: u.isVerified,
        registeredAt: u.createdAt.toISOString(),
        allocatedAt: (alloc?.createdAt || u.createdAt).toISOString(),
        slotA, slotB,
      });
    }

    for (const a of allocations) {
      if (registeredCodes.has(a.code)) continue;
      rows.push({
        key: a.code, name: a.assignedName || '—', phone: null, username: null, olympiadCode: a.code,
        classCode: a.classCode || null, className: a.className || null,
        source: null, registrationStatus: 'pending', isVerified: false,
        registeredAt: null, allocatedAt: (a.createdAt).toISOString(),
        slotA: emptySlot(), slotB: emptySlot(),
      });
    }

    rows.sort((a, b) => (a.className || '').localeCompare(b.className || '') || a.name.localeCompare(b.name));

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET school/me/reports failed:', error);
    return NextResponse.json({ message: 'Failed to fetch report' }, { status: 500 });
  }
}
