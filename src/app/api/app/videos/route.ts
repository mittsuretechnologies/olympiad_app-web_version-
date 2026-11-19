import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { captionTagsAbuseMessage } from '@/lib/profanity';
import { prisma } from '@/lib/prisma';
import { hasMittfestTag } from '@/lib/mittfest';
import { schoolAutoTags as buildSchoolAutoTags, mainCategoryTag, mergeTags } from '@/lib/videoAutoTags';
import { COPYRIGHT_DISABLED, COPYRIGHT_REMOVED_NOTICE } from '@/lib/copyright';
import { getJwtSecret } from '@/lib/jwt-secret';
import { recordCoinEvent } from '@/lib/coins/tasks';
import { ACCOUNT_TYPE_SCHOOL, UPLOADER_SCHOOL_OWN } from '@/lib/generalSchool';
import { getSchoolIdentity } from '@/lib/schoolAccount';
import { checkOlympiadCategory, checkUploadCategory, loadCategoriesSafe } from '@/lib/uploadCategories';
import { olympiadSlotOf } from '@/lib/olympiadSlots';
import { type CompetitionStage, checkStateUpload, isCompetitionCategoryName } from '@/lib/stateCompetition';

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

export async function POST(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const {
      videoUrl, thumbnailUrl, caption, category, subCategory,
      tags, isPublic, isEvaluation, olympiadId: bodyOlympiadId,
      isOlympiadUpload, olympiadVisibility, isMittfest, isStateLevel,
    } = await request.json();

    if (!videoUrl || !category || !subCategory) {
      return NextResponse.json(
        { error: 'Missing required fields: videoUrl, category, subCategory' },
        { status: 400 }
      );
    }

    const abuse = captionTagsAbuseMessage(caption, tags);
    if (abuse) {
      return NextResponse.json({ error: abuse }, { status: 422 });
    }

    // Resolve olympiadId: prefer body-supplied (entered on upload screen),
    // fall back to whatever is saved on the user's profile.
    const user = await prisma.appUser.findUnique({
      where: { id: appUser.id },
      select: { olympiadId: true, accountType: true },
    });

    // ---------- General School path ----------
    // A General School uploads as itself: never an Olympiad/evaluation video,
    // only the school categories, and only while its account is active and its
    // agreement acceptance is current.
    const isSchoolAccount = user?.accountType === ACCOUNT_TYPE_SCHOOL;
    const schoolAutoTags: string[] = [];
    if (isSchoolAccount) {
      // Either kind of school (General, or an Olympiad school's own account).
      const school = await getSchoolIdentity(appUser.id);
      if (!school || !school.isActive) {
        return NextResponse.json({ error: 'This school account is not active.' }, { status: 403 });
      }
      if (!school.agreementAccepted) {
        return NextResponse.json(
          { error: 'Please accept the School Onboarding Agreement before uploading.' },
          { status: 403 },
        );
      }
      // Only the categories the SuperAdmin gives this kind of school (dashboard
      // → Upload Categories). Enforced here, not just in the app, so a
      // hand-made request cannot post into another list.
      const problem = await checkUploadCategory(
        school.kind === 'OLYMPIAD' ? 'OLYMPIAD_SCHOOL' : 'GENERAL_SCHOOL', category, subCategory,
      );
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      // Same auto hashtags student videos get (state, district, school name; an
      // Olympiad school also carries its CRM ID).
      schoolAutoTags.push(...school.autoTags);
    }

    const olympiadCode = isSchoolAccount
      ? null
      : (bodyOlympiadId as string | undefined)?.trim().toUpperCase()
        || user?.olympiadId
        || null;

    // A State / National Level video (lib/stateCompetition.ts): flagged by the
    // app ("isStateLevel" covers both), or sent into either category by name.
    // Only a student forwarded to that level — matched by the Olympiad ID saved
    // on their account, never one typed into this request — and only one video
    // each. The stage stored is the student's current one.
    const isStateUpload = !isSchoolAccount
      && (isStateLevel === true || await isCompetitionCategoryName(category));
    let competitionStage: CompetitionStage | null = null;
    if (isStateUpload) {
      const checked = await checkStateUpload(appUser.id, user?.olympiadId, category, subCategory);
      if (checked.error !== undefined) return NextResponse.json({ error: checked.error }, { status: checked.status });
      competitionStage = checked.stage;
    } else if (!isSchoolAccount) {
      // An Olympiad video goes into one of the two Olympiad categories, with an
      // option offered to the student's class (the class letter is part of the
      // Olympiad ID). Any other upload uses the General User list — Olympiad
      // students included, once both their Olympiad videos are in.
      const problem = isOlympiadUpload || isEvaluation === true
        ? await checkOlympiadCategory(category, subCategory, { olympiadCode })
        : await checkUploadCategory('NORMAL', category, subCategory);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    }

    // ---------- Student path ----------
    let studentId: string | null = null;

    if (olympiadCode) {
      // Validate allocation exists
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where: { code: olympiadCode },
        include: {
          school: { select: { name: true, state: true, district: true, olympiadId: true } },
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
      schoolAutoTags.push(...buildSchoolAutoTags(school));
    }

    const uploaderType = isSchoolAccount ? UPLOADER_SCHOOL_OWN : olympiadCode ? 'STUDENT' : 'VIEWER';

    // Olympiad upload: auto-set isEvaluation and enforce 1-per-category slot limit.
    // A State Level video is never an Olympiad (stage-1) video.
    let finalIsEvaluation = !isSchoolAccount && !isStateUpload && isEvaluation !== undefined ? Boolean(isEvaluation) : false;
    if (isOlympiadUpload && !isSchoolAccount && !isStateUpload) {
      finalIsEvaluation = true;
      // The category label decides the slot first — subCategory may be a custom
      // "special talent" label. The slot categories' options (dashboard → Upload
      // Categories, plus the built-in spellings) fill in for older records.
      const categories = await loadCategoriesSafe();
      const slot = olympiadSlotOf(category, subCategory, categories);

      if (slot) {
        // No deletedAt filter — an evaluated video must keep blocking this slot even if it
        // was later soft-deleted (e.g. an admin removing a reported video). See the matching
        // comment in GET /api/app/olympiad-video-slots for the full reasoning.
        // Counted together with videos the school uploaded for this student under
        // their web Student record (same Olympiad ID), so the app, the web and the
        // school's own upload all see the same slots.
        const existingOlympiadVideos = await prisma.video.findMany({
          where: { OR: [{ appUserId: appUser.id }, ...(studentId ? [{ studentId }] : [])], isEvaluation: true },
          select: { category: true, subCategory: true, status: true, deletedAt: true, evaluations: { select: { id: true } } },
        });
        const matchesSlot = (v: { category: string | null; subCategory: string | null }) =>
          olympiadSlotOf(v.category, v.subCategory, categories) === slot;
        // Blocked if evaluated (regardless of delete state) or if an active, non-rejected video occupies it.
        const slotTaken = existingOlympiadVideos.some(v =>
          matchesSlot(v) && (v.evaluations.length > 0 || (v.deletedAt === null && v.status !== 'REJECTED'))
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
    // An Olympiad video also carries its main category (e.g. #TalentPerformance).
    const mergedTags = mergeTags(
      [
        ...schoolAutoTags,
        finalIsEvaluation ? mainCategoryTag(category, subCategory) : null,
        competitionStage === 'NATIONAL' ? 'NationalLevel' : isStateUpload ? 'StateLevel' : null,
      ],
      userTags,
    );

    // A "#mittfest" hashtag counts as an entry too, exactly like ticking the
    // MittFest checkbox — see src/lib/mittfest.ts.
    // A State Level competition video is not a MittFest entry.
    const finalIsMittfest = !isStateUpload
      && ((isMittfest !== undefined ? Boolean(isMittfest) : false) || hasMittfestTag(userTags));

    const newVideo = await prisma.video.create({
      data: {
        studentId:    studentId ?? undefined,
        appUserId:    appUser.id,
        uploaderType,
        videoUrl,
        thumbnailUrl: thumbnailUrl ?? null,
        caption,
        category,
        subCategory,
        tags:         mergedTags,
        isPublic:     isPublic     !== undefined ? Boolean(isPublic)     : true,
        isEvaluation: finalIsEvaluation,
        isMittfest:   finalIsMittfest,
        olympiadVisibility: finalIsEvaluation
          ? (olympiadVisibility === 'private' ? 'private' : 'public')
          : null,
        competitionStage,
        status: 'PENDING',
      },
    });

    void recordCoinEvent(appUser.id, 'UPLOAD_VIDEO').catch(() => {});
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
      where: { appUserId: appUser.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { evaluations: { select: { id: true } } },
    });

    // This response previously had no isLiked field, so the star always showed
    // empty on your own videos (e.g. in the Profile "Videos" tab) even if you'd
    // starred your own upload.
    const likedIds = videos.length > 0
      ? new Set((await prisma.like.findMany({
          where:  { userId: appUser.id, videoId: { in: videos.map(v => v.id) } },
          select: { videoId: true },
        })).map(l => l.videoId))
      : new Set<string>();

    // Copyright takedowns: the notice to show in place of the video, and when it
    // will be reviewed (the latest date, if more than one notice holds it down).
    const disabledIds = videos.filter(v => v.status === COPYRIGHT_DISABLED).map(v => v.id);
    const reviewDates = new Map(
      disabledIds.length
        ? (await prisma.infringementNotice.findMany({
            where:   { videoId: { in: disabledIds }, disabledAt: { not: null }, reviewOutcome: null },
            orderBy: { reviewDueAt: 'asc' },
            select:  { videoId: true, reviewDueAt: true },
          })).map(n => [n.videoId!, n.reviewDueAt])
        : [],
    );

    // Expose only whether marks exist (not the scores themselves — those stay
    // gated behind VideoEvaluation.isPublished) so the app can block/explain deletion.
    const normalized = videos.map(({ evaluations, ...v }) => ({
      ...v,
      isLiked: likedIds.has(v.id),
      hasEvaluation: !!evaluations?.length,
      ...(v.status === COPYRIGHT_DISABLED
        ? { removedNotice: COPYRIGHT_REMOVED_NOTICE, copyrightReviewDate: reviewDates.get(v.id) ?? null }
        : {}),
    }));

    return NextResponse.json(normalized);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
