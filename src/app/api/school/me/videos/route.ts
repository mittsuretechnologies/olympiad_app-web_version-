import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

// POST — save video metadata on behalf of a student
export async function POST(request: Request) {
  try {
    const school = getSchoolFromToken(request);
    if (!school) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { studentId, videoUrl, caption, category, subCategory, tags, isPublic } =
      await request.json();

    if (!studentId || !videoUrl || !category || !subCategory) {
      return NextResponse.json(
        { error: 'Missing required fields: studentId, videoUrl, category, subCategory' },
        { status: 400 }
      );
    }

    // Verify student belongs to this school
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        allocation: {
          include: {
            school: { select: { id: true, name: true, city: true, district: true, state: true, schoolId: true } },
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    if (student.allocation?.school?.id !== school.id) {
      return NextResponse.json({ error: 'This student does not belong to your school' }, { status: 403 });
    }

    // Auto-decide isEvaluation: first 2 approved videos = olympiad, rest = general feed
    const approvedCount = await prisma.video.count({
      where: { studentId, isEvaluation: true, status: 'APPROVED' },
    });
    const isEvaluation = approvedCount < 2;

    // Auto-build location hashtags from school info
    const schoolInfo = student.allocation?.school;
    const autoTags: string[] = [];
    if (schoolInfo?.state)    autoTags.push(schoolInfo.state.replace(/\s+/g, ''));
    if (schoolInfo?.district) autoTags.push(schoolInfo.district.replace(/\s+/g, ''));
    if (schoolInfo?.name)     autoTags.push(schoolInfo.name.replace(/\s+/g, ''));
    if (schoolInfo?.schoolId) autoTags.push(schoolInfo.schoolId);

    const userTags: string[] = tags
      ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];
    const mergedTags = [...new Set([...autoTags, ...userTags])].join(',');

    const newVideo = await prisma.video.create({
      data: {
        studentId,
        videoUrl,
        caption,
        category,
        subCategory,
        tags: mergedTags,
        isPublic:     isPublic !== undefined ? Boolean(isPublic) : true,
        isEvaluation,
        uploaderType: 'SCHOOL',
        status: 'PENDING',
      },
    });

    return NextResponse.json(newVideo, { status: 201 });
  } catch (error: any) {
    console.error('School videos POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET — list videos uploaded by this school (on behalf of students)
export async function GET(request: Request) {
  try {
    const school = getSchoolFromToken(request);
    if (!school) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videos = await prisma.video.findMany({
      where: { uploaderType: 'SCHOOL', student: { allocation: { schoolId: school.id } } },
      include: { student: { select: { id: true, name: true, olympiadCode: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(videos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
