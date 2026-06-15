import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

function fixUrl(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const target = new URL(SERVER_URL);
    parsed.protocol = target.protocol;
    parsed.hostname = target.hostname;
    parsed.port     = target.port;
    return parsed.toString();
  } catch { return url; }
}

// GET /api/school/videos?schoolId=<school.id>
// Returns all approved public videos from a school, resolved via:
// School.id → OlympiadIdAllocation.schoolId → AppUser.olympiadId → Video.appUserId
// Also covers Student.allocation.schoolId → Video.studentId
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get('schoolId')?.trim();

  if (!schoolId) {
    return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
  }

  try {
    // Find all allocation codes for this school
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId },
      select: { code: true },
    });
    const codes = allocations.map(a => a.code);

    // AppUsers whose olympiadId matches one of those codes
    const appUsers = codes.length > 0
      ? await prisma.appUser.findMany({
          where: { olympiadId: { in: codes } },
          select: { id: true, userId: true, avatarUrl: true, olympiadId: true },
        })
      : [];
    const appUserIds = appUsers.map(u => u.id);
    const appUserMap = new Map(appUsers.map(u => [u.id, u]));
    const allocMap   = new Map(appUsers.map(u => [u.id, u.olympiadId]));

    // Students whose allocation points to this school
    const students = codes.length > 0
      ? await prisma.student.findMany({
          where: { allocation: { code: { in: codes } } },
          select: { id: true, name: true },
        })
      : [];
    const studentIds = students.map(s => s.id);
    const studentMap = new Map(students.map(s => [s.id, s]));

    // Fetch approved public videos from both appUsers and students
    const videos = await prisma.video.findMany({
      where: {
        status:   'APPROVED',
        isPublic: true,
        OR: [
          ...(appUserIds.length > 0 ? [{ appUserId: { in: appUserIds } }] : []),
          ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id:           true,
        videoUrl:     true,
        thumbnailUrl: true,
        caption:      true,
        category:     true,
        subCategory:  true,
        likesCount:   true,
        viewsCount:   true,
        isEvaluation: true,
        appUserId:    true,
        studentId:    true,
        createdAt:    true,
      },
    });

    // Fetch school info for the response
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, city: true, state: true },
    });

    const result = videos.map(v => {
      const au  = v.appUserId ? appUserMap.get(v.appUserId) : undefined;
      const stu = v.studentId ? studentMap.get(v.studentId) : undefined;
      return {
        id:           v.id,
        videoUrl:     fixUrl(v.videoUrl) ?? v.videoUrl,
        thumbnailUrl: fixUrl(v.thumbnailUrl),
        caption:      v.caption,
        category:     v.category,
        subCategory:  v.subCategory,
        likesCount:   v.likesCount,
        viewsCount:   v.viewsCount,
        isEvaluation: v.isEvaluation,
        createdAt:    v.createdAt,
        appUser: au ? { id: au.id, userId: au.userId, avatarUrl: fixUrl(au.avatarUrl) } : null,
        student: stu ? {
          id:         stu.id,
          name:       stu.name,
          schoolId:   school?.id   ?? null,
          schoolName: school?.name ?? null,
          state:      school?.state ?? null,
          city:       school?.city  ?? null,
        } : school ? {
          id:         null,
          name:       au?.userId ?? null,
          schoolId:   school.id,
          schoolName: school.name,
          state:      school.state ?? null,
          city:       school.city  ?? null,
        } : null,
      };
    });

    return NextResponse.json({ videos: result, school });
  } catch (error) {
    console.error('GET /api/school/videos failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
