import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { captionTagsAbuseMessage } from '@/lib/profanity';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { ensureSchoolAccount, getSchoolIdentity } from '@/lib/schoolAccount';
import { UPLOADER_SCHOOL_OWN } from '@/lib/generalSchool';
import { SCHOOL_CATEGORY_GROUPS } from '@/lib/schoolUploadCategories';
import { mergeTags } from '@/lib/videoAutoTags';
import { hasMittfestTag } from '@/lib/mittfest';

const JWT_SECRET = getJwtSecret();

function getSchoolFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'SCHOOL') return null;
    return decoded;
  } catch {
    return null;
  }
}

// POST - save the school's OWN video (Annual Day, a class activity, …) from
// the web portal: the same upload the app's "Our own video" mode makes through
// /api/app/videos. It is stored under the school's app account, so it shows on
// the school's profile in the app, is never an Olympiad/evaluation entry, and
// goes to moderation like every other video.
export async function POST(request: Request) {
  const token = getSchoolFromToken(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { videoUrl, thumbnailUrl, caption, category, subCategory, tags } = await request.json();

    if (!videoUrl || !category || !subCategory) {
      return NextResponse.json({ error: 'Missing required fields: videoUrl, category, subCategory' }, { status: 400 });
    }
    const group = SCHOOL_CATEGORY_GROUPS.find((g) => g.label === category);
    if (!group) {
      return NextResponse.json({ error: 'This category is not available for school accounts.' }, { status: 400 });
    }
    if (!group.subs.includes(subCategory)) {
      return NextResponse.json({ error: `Pick a valid ${category} type.` }, { status: 400 });
    }

    const userTags: string[] = typeof tags === 'string'
      ? tags.split(',').map((t: string) => t.trim().replace(/^#+/, '')).filter(Boolean).slice(0, 30)
      : [];
    const abuse = captionTagsAbuseMessage(caption, userTags.join(','));
    if (abuse) return NextResponse.json({ error: abuse }, { status: 422 });

    const school = await prisma.school.findUnique({
      where: { id: token.id },
      select: { id: true, username: true, schoolId: true, name: true },
    });
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

    const account = await ensureSchoolAccount(school);
    const identity = await getSchoolIdentity(account.id);
    if (!identity || !identity.isActive) {
      return NextResponse.json({ error: 'This school account is not active.' }, { status: 403 });
    }
    if (!identity.agreementAccepted) {
      return NextResponse.json(
        { error: 'Please accept the School Onboarding Agreement before uploading.' },
        { status: 403 },
      );
    }

    const video = await prisma.video.create({
      data: {
        appUserId: account.id,
        uploaderType: UPLOADER_SCHOOL_OWN,
        videoUrl,
        thumbnailUrl: thumbnailUrl ?? null,
        caption: typeof caption === 'string' ? caption.trim() : null,
        category,
        subCategory,
        tags: mergeTags(identity.autoTags, userTags),
        // The app offers no visibility choice for a school's own video.
        isPublic: true,
        isEvaluation: false,
        // As in the app: no MittFest tick here, but a #mittfest hashtag still enters it.
        isMittfest: hasMittfestTag(userTags),
        olympiadVisibility: null,
        status: 'PENDING',
      },
    });

    return NextResponse.json(video, { status: 201 });
  } catch (error: any) {
    console.error('School own video POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
