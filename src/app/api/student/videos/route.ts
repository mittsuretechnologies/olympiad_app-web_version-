import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

    // Fetch the student's school to auto-build location hashtags
    const studentRecord = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        allocation: {
          include: {
            school: {
              select: { name: true, city: true, district: true, state: true, schoolId: true },
            },
          },
        },
      },
    });

    // Build auto hashtags from school location — sanitize to single words, no spaces
    const school = studentRecord?.allocation?.school;
    const autoTags: string[] = [];
    if (school?.state)    autoTags.push(school.state.replace(/\s+/g, ''));
    if (school?.district) autoTags.push(school.district.replace(/\s+/g, ''));
    if (school?.name)     autoTags.push(school.name.replace(/\s+/g, ''));
    if (school?.schoolId) autoTags.push(school.schoolId);

    // Merge user-supplied tags with auto-generated school tags (dedup)
    const userTags: string[] = tags
      ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];
    const mergedTags = [...new Set([...autoTags, ...userTags])].join(',');

    const newVideo = await prisma.video.create({
      data: {
        studentId: student.id,
        videoUrl,
        caption,
        category,
        subCategory,
        tags: mergedTags,
        isPublic:    isPublic    !== undefined ? Boolean(isPublic)    : true,
        isEvaluation: isEvaluation !== undefined ? Boolean(isEvaluation) : false,
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
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });

    // Rewrite stored URLs to use 10.0.2.2 so the Android emulator can reach the server.
    // 10.0.2.2 is the emulator's alias for the host machine's localhost.
    const normalized = videos.map(v => ({
      ...v,
      videoUrl: v.videoUrl?.replace(/^https?:\/\/[^/]+/, 'http://10.0.2.2:3000') ?? v.videoUrl,
    }));

    return NextResponse.json(normalized);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
