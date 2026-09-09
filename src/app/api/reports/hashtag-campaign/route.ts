import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireModule } from '@/lib/auth-guard';

// Campaign report: videos carrying a specific hashtag (e.g. #mittfest), grouped
// by uploader, so prize-eligibility can be checked at a glance — who submitted,
// how many, and which videos. tags is a free-text comma-separated string (see
// Video.tags), so this narrows with a DB-level `contains` first (cheap, uses
// the index-free scan just once) then confirms an exact tag match in app code
// — a contains-only match would wrongly include e.g. "#mittfestival".
export async function GET(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN', 'REVIEWER', 'EVALUATOR', 'MODERATOR']);
  if (error) return error;
  const moduleCheck = await requireModule(payload, 'reports.hashtag');
  if (moduleCheck.error) return moduleCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const rawTag = (searchParams.get('tag') || 'mittfest').trim().replace(/^#/, '');
    if (!rawTag) return NextResponse.json({ message: 'tag is required' }, { status: 400 });
    const tagLower = rawTag.toLowerCase();

    const candidates = await prisma.video.findMany({
      where: {
        deletedAt: null,
        tags: { contains: rawTag, mode: 'insensitive' },
      },
      select: {
        id: true, videoUrl: true, thumbnailUrl: true, caption: true, tags: true,
        category: true, subCategory: true, status: true, quality: true, createdAt: true,
        uploaderType: true, appUserId: true, studentId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const videos = candidates.filter(v =>
      (v.tags || '').split(',').map(t => t.trim().toLowerCase()).includes(tagLower)
    );

    const appUserIds = [...new Set(videos.filter(v => v.appUserId).map(v => v.appUserId as string))];
    const studentIds = [...new Set(videos.filter(v => v.studentId).map(v => v.studentId as string))];

    const [appUsers, students] = await Promise.all([
      appUserIds.length
        ? prisma.appUser.findMany({
            where: { id: { in: appUserIds } },
            select: { id: true, userId: true, email: true, mobile: true, olympiadId: true },
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.student.findMany({
            where: { id: { in: studentIds } },
            select: { id: true, name: true, olympiadCode: true },
          })
        : Promise.resolve([]),
    ]);
    const appUserById = new Map(appUsers.map(u => [u.id, u]));
    const studentById = new Map(students.map(s => [s.id, s]));

    type UploaderGroup = {
      uploaderKey: string;
      uploaderType: string;
      name: string;
      identifier: string;
      videoCount: number;
      videos: typeof videos;
    };
    const groups = new Map<string, UploaderGroup>();

    for (const v of videos) {
      let uploaderKey: string, name: string, identifier: string;
      if (v.studentId && studentById.has(v.studentId)) {
        const s = studentById.get(v.studentId)!;
        uploaderKey = `student:${s.id}`;
        name = s.name;
        identifier = s.olympiadCode;
      } else if (v.appUserId && appUserById.has(v.appUserId)) {
        const u = appUserById.get(v.appUserId)!;
        uploaderKey = `appuser:${u.id}`;
        name = u.userId;
        identifier = u.email || u.mobile || u.olympiadId || u.userId;
      } else {
        uploaderKey = `unknown:${v.id}`;
        name = 'Unknown uploader';
        identifier = '-';
      }

      if (!groups.has(uploaderKey)) {
        groups.set(uploaderKey, {
          uploaderKey, uploaderType: v.uploaderType, name, identifier,
          videoCount: 0, videos: [],
        });
      }
      const g = groups.get(uploaderKey)!;
      g.videoCount += 1;
      g.videos.push(v);
    }

    const uploaders = [...groups.values()].sort((a, b) => b.videoCount - a.videoCount);

    return NextResponse.json({
      tag: rawTag,
      totalVideos: videos.length,
      totalUploaders: uploaders.length,
      uploaders,
    });
  } catch (error: any) {
    console.error('GET reports/hashtag-campaign failed:', error);
    return NextResponse.json({ message: 'Failed to fetch report', error: error?.message }, { status: 500 });
  }
}
