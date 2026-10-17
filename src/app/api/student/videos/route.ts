import { NextResponse } from 'next/server';
import { captionTagsAbuseMessage } from '@/lib/profanity';
import { prisma } from '@/lib/prisma';
import { verify } from 'jsonwebtoken';
import { hasMittfestTag } from '@/lib/mittfest';
import { schoolAutoTags, mainCategoryTag, mergeTags } from '@/lib/videoAutoTags';
import { getJwtSecret } from '@/lib/jwt-secret';

const JWT_SECRET = getJwtSecret();

async function getStudentFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    // Accept both 'student' (from student-login) and 'STUDENT' (from verify-otp)
    if (decoded.role !== 'student' && decoded.role !== 'STUDENT') return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const student = await getStudentFromToken(request);
    if (!student) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoUrl, caption, category, subCategory, tags, isPublic, isEvaluation } =
      await request.json();

    if (!videoUrl || !category || !subCategory) {
      return NextResponse.json({ error: 'Missing required fields: videoUrl, category, subCategory' }, { status: 400 });
    }

    const abuse = captionTagsAbuseMessage(caption, tags);
    if (abuse) {
      return NextResponse.json({ error: abuse }, { status: 422 });
    }

    // Fetch the student's school to auto-build location hashtags
    const studentRecord = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        allocation: {
          include: {
            school: {
              select: { name: true, city: true, district: true, state: true, olympiadId: true },
            },
          },
        },
      },
    });

    // Auto hashtags from the school (state, district, name, CRM ID); an
    // Olympiad video also carries its main category.
    const school = studentRecord?.allocation?.school;
    const finalIsEvaluation = isEvaluation !== undefined ? Boolean(isEvaluation) : false;
    const autoTags = [
      ...schoolAutoTags(school),
      finalIsEvaluation ? mainCategoryTag(category, subCategory) : null,
    ];

    // Merge user-supplied tags with auto-generated school tags (dedup)
    const userTags: string[] = tags
      ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];
    const mergedTags = mergeTags(autoTags, userTags);

    const newVideo = await prisma.video.create({
      data: {
        studentId: student.id,
        videoUrl,
        caption,
        category,
        subCategory,
        tags: mergedTags,
        isPublic:    isPublic    !== undefined ? Boolean(isPublic)    : true,
        isEvaluation: finalIsEvaluation,
        // This form has no MittFest checkbox, so the hashtag is the only way in.
        isMittfest: hasMittfestTag(userTags),
        status: 'PENDING',
      },
    });

    return NextResponse.json(newVideo, { status: 201 });
  } catch (error: any) {
    console.error('Video Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const student = await getStudentFromToken(request);
    if (!student) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videos = await prisma.video.findMany({
      where: { studentId: student.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(videos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
