import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

const VIDEO_SELECT = {
  id: true, videoUrl: true, thumbnailUrl: true, caption: true, category: true, subCategory: true,
  status: true, rejectionReason: true, isEvaluation: true, olympiadVisibility: true,
  createdAt: true, studentId: true, appUserId: true, likesCount: true, viewsCount: true,
} as const;

// The school's own videos: everything under its app account (uploaded from the
// app or from the web portal's "Our own video"). The app reads these from the
// school's profile instead, so they are only added on request (?includeOwn=1).
async function schoolOwnVideos(schoolId: string) {
  const account = await prisma.appUser.findUnique({ where: { schoolRefId: schoolId }, select: { id: true } });
  if (!account) return [];
  const videos = await prisma.video.findMany({
    where: { appUserId: account.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: VIDEO_SELECT,
  });
  return videos.map(v => ({
    id: v.id,
    kind: 'SCHOOL' as const,
    videoUrl: v.videoUrl,
    thumbnailUrl: v.thumbnailUrl,
    caption: v.caption || '',
    category: v.category || '',
    subCategory: v.subCategory || '',
    status: v.status,
    rejectionReason: v.rejectionReason,
    isEvaluation: v.isEvaluation,
    olympiadVisibility: v.olympiadVisibility,
    likesCount: v.likesCount,
    viewsCount: v.viewsCount,
    createdAt: v.createdAt,
    studentName: null,
    olympiadCode: null,
    className: null,
  }));
}

// GET /api/school/me/uploaded-videos
// Every video this school uploaded ON BEHALF OF its students, in any state
// (pending review, approved, rejected with the reason). The Status tab of the
// school's profile in the app shows these next to the school's own videos.
//
// Student Videos (/api/school/me/student-videos) only ever lists APPROVED
// videos, so a school could not otherwise see what is still waiting or why one
// was rejected.
//
// ?includeOwn=1 (the web portal's Upload Status page) also returns the
// school's own videos, each row tagged kind "SCHOOL" or "STUDENT".
export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['SCHOOL']);
  if (error) return error;

  try {
    const includeOwn = new URL(request.url).searchParams.get('includeOwn') === '1';
    const own = includeOwn ? await schoolOwnVideos(payload.id) : [];

    // The school's students, by either record: web Student rows and app accounts
    // that hold one of its Olympiad IDs.
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: payload.id },
      select: { code: true, classCode: true, className: true, assignedName: true },
    });
    const byCode = new Map(allocations.map(a => [a.code, a]));
    const codes = allocations.map(a => a.code);
    if (codes.length === 0) return NextResponse.json(own);

    const [students, appUsers] = await Promise.all([
      prisma.student.findMany({ where: { olympiadCode: { in: codes } }, select: { id: true, name: true, olympiadCode: true } }),
      prisma.appUser.findMany({ where: { olympiadId: { in: codes } }, select: { id: true, userId: true, olympiadId: true } }),
    ]);
    const studentById = new Map(students.map(s => [s.id, s]));
    const appUserById = new Map(appUsers.map(u => [u.id, u]));

    const videos = await prisma.video.findMany({
      where: {
        uploaderType: 'SCHOOL',
        deletedAt: null,
        OR: [
          ...(students.length ? [{ studentId: { in: students.map(s => s.id) } }] : []),
          ...(appUsers.length ? [{ appUserId: { in: appUsers.map(u => u.id) } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: VIDEO_SELECT,
    });

    const forStudents = videos.map(v => {
      const stu = v.studentId ? studentById.get(v.studentId) : undefined;
      const au = v.appUserId ? appUserById.get(v.appUserId) : undefined;
      const code = stu?.olympiadCode ?? au?.olympiadId ?? null;
      const alloc = code ? byCode.get(code) : undefined;
      return {
        id: v.id,
        kind: 'STUDENT' as const,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        caption: v.caption || '',
        category: v.category || '',
        subCategory: v.subCategory || '',
        status: v.status,
        rejectionReason: v.rejectionReason,
        isEvaluation: v.isEvaluation,
        olympiadVisibility: v.olympiadVisibility,
        likesCount: v.likesCount,
        viewsCount: v.viewsCount,
        createdAt: v.createdAt,
        studentName: alloc?.assignedName || stu?.name || au?.userId || '-',
        olympiadCode: code,
        className: alloc?.className ?? null,
      };
    });

    if (!includeOwn) return NextResponse.json(forStudents);
    return NextResponse.json(
      [...own, ...forStudents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
  } catch (err) {
    console.error('GET school/me/uploaded-videos failed:', err);
    return NextResponse.json({ message: 'Failed to fetch videos' }, { status: 500 });
  }
}
