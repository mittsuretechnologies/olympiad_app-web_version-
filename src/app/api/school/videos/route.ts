import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { visibilityWhere } from '@/lib/videoVisibility';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getViewerIdFromToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    return decoded.role === 'APP_USER' ? decoded.id : null;
  } catch { return null; }
}

// GET /api/school/videos?schoolId=<school.id>
// Returns all approved public videos from a school, resolved via:
// School.id → OlympiadIdAllocation.schoolId → AppUser.olympiadId → Video.appUserId
// Also covers Student.allocation.schoolId → Video.studentId
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const schoolId  = searchParams.get('schoolId')?.trim();
  const viewerId  = getViewerIdFromToken(request);

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

    // If no members found for this school, return empty
    if (appUserIds.length === 0 && studentIds.length === 0) {
      return NextResponse.json({ videos: [], school: await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, city: true, state: true } }) });
    }

    // Apply profile-privacy visibility filter
    const visWhere = await visibilityWhere(viewerId);

    // Fetch approved public videos from both appUsers and students
    const videos = await prisma.video.findMany({
      where: {
        status:   'APPROVED',
        isPublic: true,
        ...visWhere,
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
        tags:         true,
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
        videoUrl:     v.videoUrl,
        thumbnailUrl: v.thumbnailUrl,
        caption:      v.caption,
        tags:         v.tags,
        category:     v.category,
        subCategory:  v.subCategory,
        likesCount:   v.likesCount,
        viewsCount:   v.viewsCount,
        isEvaluation: v.isEvaluation,
        createdAt:    v.createdAt,
        appUser: au ? { id: au.id, userId: au.userId, avatarUrl: au.avatarUrl } : null,
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
