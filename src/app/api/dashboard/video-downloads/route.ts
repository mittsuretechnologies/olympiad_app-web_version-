import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { getSignedMediaUrl } from '@/lib/s3';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

// GET /api/dashboard/video-downloads — SuperAdmin's "Download Videos" list:
// every uploaded video (user-deleted ones excluded), newest first, paginated.
// Filters: status, uploader (STUDENT | VIEWER | SCHOOL), category, mittfest=1,
// from / to (YYYY-MM-DD, upload date), search (caption, hashtags, username,
// Olympiad ID, email, student name or school name), page.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const sp = new URL(request.url).searchParams;
    const status   = sp.get('status');
    const uploader = sp.get('uploader');
    const category = sp.get('category');
    const mittfest = sp.get('mittfest') === '1';
    const from     = sp.get('from');
    const to       = sp.get('to');
    const search   = sp.get('search')?.trim();
    const page     = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);

    const where: Record<string, any> = { deletedAt: null };
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) where.status = status;
    if (uploader && ['STUDENT', 'VIEWER', 'SCHOOL'].includes(uploader)) where.uploaderType = uploader;
    if (category) where.category = category;
    if (mittfest) where.isMittfest = true;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(`${from}T00:00:00`);
      if (to)   where.createdAt.lte = new Date(`${to}T23:59:59.999`);
    }

    if (search) {
      const q = { contains: search, mode: 'insensitive' as const };
      // Video has no appUser relation, so uploader / school matches are
      // resolved to appUser ids first.
      const [users, allocs] = await Promise.all([
        prisma.appUser.findMany({
          where: { OR: [{ userId: q }, { olympiadId: q }, { email: q }, { guardianName: q }, { childName: q }] },
          select: { id: true },
          take: 2000,
        }),
        prisma.olympiadIdAllocation.findMany({
          where: { OR: [{ assignedName: q }, { code: q }, { school: { name: q } }] },
          select: { code: true },
          take: 5000,
        }),
      ]);
      const viaAlloc = allocs.length
        ? await prisma.appUser.findMany({ where: { olympiadId: { in: allocs.map((a) => a.code) } }, select: { id: true } })
        : [];
      const ids = [...new Set([...users, ...viaAlloc].map((u) => u.id))];
      where.OR = [
        { caption: q }, { tags: q }, { subCategory: q },
        { student: { name: q } }, { student: { olympiadCode: q } },
        { student: { allocation: { school: { name: q } } } },
        ...(ids.length ? [{ appUserId: { in: ids } }] : []),
      ];
    }

    const [total, rows, categories] = await Promise.all([
      prisma.video.count({ where }),
      prisma.video.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true, appUserId: true, uploaderType: true, thumbnailUrl: true, caption: true,
          category: true, subCategory: true, status: true, isMittfest: true, isEvaluation: true,
          viewsCount: true, likesCount: true, createdAt: true,
          student: {
            select: { name: true, olympiadCode: true, allocation: { select: { school: { select: { name: true } } } } },
          },
        },
      }),
      prisma.video.findMany({
        where: { deletedAt: null, category: { not: null } },
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
    ]);

    // Uploader details for app accounts (+ name / school via their Olympiad ID).
    const appUserIds = [...new Set(rows.map((r) => r.appUserId).filter(Boolean) as string[])];
    const appUsers = appUserIds.length
      ? await prisma.appUser.findMany({
          where: { id: { in: appUserIds } },
          select: { id: true, userId: true, olympiadId: true },
        })
      : [];
    const codes = appUsers.map((u) => u.olympiadId).filter(Boolean) as string[];
    const allocations = codes.length
      ? await prisma.olympiadIdAllocation.findMany({
          where: { code: { in: codes } },
          select: { code: true, assignedName: true, school: { select: { name: true } } },
        })
      : [];
    const allocBy = new Map(allocations.map((a) => [a.code, a]));
    const userBy = new Map(appUsers.map((u) => [u.id, u]));

    const videos = await Promise.all(rows.map(async (r) => {
      const u = r.appUserId ? userBy.get(r.appUserId) : undefined;
      const a = u?.olympiadId ? allocBy.get(u.olympiadId) : undefined;
      return {
        id: r.id,
        caption: r.caption,
        category: r.category,
        subCategory: r.subCategory,
        status: r.status,
        uploaderType: r.uploaderType,
        isMittfest: r.isMittfest,
        isEvaluation: r.isEvaluation,
        viewsCount: r.viewsCount,
        likesCount: r.likesCount,
        createdAt: r.createdAt,
        thumbnailUrl: await getSignedMediaUrl(r.thumbnailUrl),
        uploader: {
          name: a?.assignedName ?? r.student?.name ?? null,
          username: u?.userId ?? null,
          olympiadId: u?.olympiadId ?? r.student?.olympiadCode ?? null,
          school: a?.school?.name ?? r.student?.allocation?.school?.name ?? null,
        },
      };
    }));

    return NextResponse.json({
      videos,
      total,
      page,
      pageSize: PAGE_SIZE,
      categories: categories.map((c) => c.category),
    });
  } catch (e: any) {
    console.error('video-downloads list error:', e);
    return NextResponse.json({ message: e.message || 'Failed to load videos' }, { status: 500 });
  }
}
