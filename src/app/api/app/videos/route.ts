import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import {
  OLYMPIAD_CAT_A_SUBS,
  OLYMPIAD_CAT_B_SUBS,
} from '../olympiad-video-slots/route';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

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

export async function POST(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      videoUrl, caption, category, subCategory,
      tags, isPublic, isEvaluation, olympiadId: bodyOlympiadId,
      isOlympiadUpload,
    } = await request.json();

    if (!videoUrl || !category || !subCategory) {
      return NextResponse.json(
        { error: 'Missing required fields: videoUrl, category, subCategory' },
        { status: 400 }
      );
    }

    // Resolve olympiadId: prefer body-supplied (entered on upload screen),
    // fall back to whatever is saved on the user's profile.
    const user = await prisma.appUser.findUnique({
      where: { id: appUser.id },
      select: { olympiadId: true },
    });

    const olympiadCode = (bodyOlympiadId as string | undefined)?.trim().toUpperCase()
      || user?.olympiadId
      || null;

    // ---------- Student path ----------
    let studentId: string | null = null;
    let schoolAutoTags: string[] = [];

    if (olympiadCode) {
      // Validate allocation exists
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where: { code: olympiadCode },
        include: {
          school: { select: { name: true, state: true, district: true, schoolId: true } },
        },
      });

      if (!allocation) {
        return NextResponse.json(
          { error: 'Invalid Olympiad ID. Please check and try again.' },
          { status: 404 }
        );
      }

      // Find or surface the linked Student record
      const student = await prisma.student.findUnique({
        where: { olympiadCode },
        select: { id: true },
      });
      studentId = student?.id ?? null;

      // Save olympiadId to profile only if not already set (locked after first olympiad video)
      if (bodyOlympiadId && !user?.olympiadId) {
        await prisma.appUser.update({
          where: { id: appUser.id },
          data: { olympiadId: olympiadCode },
        });
      }

      // Build school auto-tags from the allocation's school
      const school = allocation.school;
      if (school?.state)    schoolAutoTags.push(school.state.replace(/\s+/g, ''));
      if (school?.district) schoolAutoTags.push(school.district.replace(/\s+/g, ''));
      if (school?.name)     schoolAutoTags.push(school.name.replace(/\s+/g, ''));
      if (school?.schoolId) schoolAutoTags.push(school.schoolId);
    }

    const uploaderType = olympiadCode ? 'STUDENT' : 'VIEWER';

    // Olympiad upload: auto-set isEvaluation and enforce 1-per-category slot limit
    let finalIsEvaluation = isEvaluation !== undefined ? Boolean(isEvaluation) : false;
    if (isOlympiadUpload) {
      finalIsEvaluation = true;
      const isSubCatA = OLYMPIAD_CAT_A_SUBS.includes(subCategory);
      const isSubCatB = OLYMPIAD_CAT_B_SUBS.includes(subCategory);

      if (isSubCatA || isSubCatB) {
        const existingOlympiadVideos = await prisma.video.findMany({
          where: { appUserId: appUser.id, isEvaluation: true },
          select: { subCategory: true, status: true },
        });
        // Only block if there's an active (non-rejected) video for this category
        const slotTaken = existingOlympiadVideos.some(v =>
          v.status !== 'REJECTED' &&
          (isSubCatA
            ? OLYMPIAD_CAT_A_SUBS.includes(v.subCategory ?? '')
            : OLYMPIAD_CAT_B_SUBS.includes(v.subCategory ?? ''))
        );
        if (slotTaken) {
          return NextResponse.json(
            { error: 'You have already submitted an Olympiad video for this category.' },
            { status: 409 }
          );
        }
      }
    }

    // Merge school tags + user custom tags; school tags always go to backend
    const userTags: string[] = tags
      ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];
    const mergedTags = [...new Set([...schoolAutoTags, ...userTags])].join(',');

    const newVideo = await prisma.video.create({
      data: {
        studentId:    studentId ?? undefined,
        appUserId:    appUser.id,
        uploaderType,
        videoUrl,
        caption,
        category,
        subCategory,
        tags:         mergedTags,
        isPublic:     isPublic     !== undefined ? Boolean(isPublic)     : true,
        isEvaluation: finalIsEvaluation,
        status: 'PENDING',
      },
    });

    return NextResponse.json(newVideo, { status: 201 });
  } catch (error: any) {
    console.error('App video save error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Return all videos uploaded by this app user (both student and viewer)
    const videos = await prisma.video.findMany({
      where: { appUserId: appUser.id },
      orderBy: { createdAt: 'desc' },
    });

    const normalized = videos.map((v) => ({
      ...v,
      videoUrl: v.videoUrl?.replace(/^https?:\/\/[^/]+/, 'http://10.0.2.2:3000') ?? v.videoUrl,
    }));

    return NextResponse.json(normalized);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
