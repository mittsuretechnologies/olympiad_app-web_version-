import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verify } from 'jsonwebtoken';
import { hasMittfestTag } from '@/lib/mittfest';
import { getJwtSecret } from '@/lib/jwt-secret';
import { olympiadSlotOf, resolveSchoolStudent, slotsForStudent } from '@/lib/olympiadSlots';

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

// POST - save a video a school uploaded ON BEHALF OF one of its students (a web
// Student or an app AppUser). Used by the web portal and by the mobile app.
//
// A school can only upload the student's Olympiad videos:
//   - the category must be an Olympiad one (Talent Performance, or Rhymes /
//     Speech), never a general category;
//   - one video per category, counted across EVERY upload of that student (the
//     student's own app included) - a rejected video frees its slot again;
//   - once both categories are filled, nothing more can be uploaded for them.
// The school picks public or private here, and cannot change it afterwards.
export async function POST(request: Request) {
  try {
    const school = getSchoolFromToken(request);
    if (!school) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { studentId, videoUrl, thumbnailUrl, caption, category, subCategory, tags, isPublic } =
      await request.json();

    const wantsPublic = isPublic !== undefined ? Boolean(isPublic) : true;

    if (!studentId || !videoUrl || !category || !subCategory) {
      return NextResponse.json(
        { error: 'Missing required fields: studentId, videoUrl, category, subCategory' },
        { status: 400 }
      );
    }

    const schoolRow = await prisma.school.findUnique({
      where: { id: school.id },
      select: { id: true, name: true, city: true, district: true, state: true, schoolId: true, isActive: true },
    });
    if (!schoolRow || !schoolRow.isActive) {
      return NextResponse.json({ error: 'This school account is not active.' }, { status: 403 });
    }

    const student = await resolveSchoolStudent(school.id, String(studentId));
    if (!student) {
      return NextResponse.json({ error: 'This student does not belong to your school' }, { status: 403 });
    }

    // Olympiad categories only.
    const slot = olympiadSlotOf(category);
    if (!slot) {
      return NextResponse.json(
        { error: 'Schools can only upload a student\'s Olympiad videos (Talent Performance or Rhymes / Speech).' },
        { status: 400 },
      );
    }

    const slots = await slotsForStudent(student);
    const used = slot === 'A' ? slots.slotA : slots.slotB;
    if (used) {
      return NextResponse.json(
        {
          error: slots.slotA && slots.slotB
            ? 'This student already has both Olympiad videos, so nothing more can be uploaded for them.'
            : 'This student already has a video in that category.',
          code: 'SLOT_TAKEN',
        },
        { status: 409 },
      );
    }

    const mergedTags = buildTags(schoolRow, tags);

    // The video belongs to the student's web record if they have one, else to
    // their app account (same split the web form has always used).
    const owner = student.studentRowId
      ? { studentId: student.studentRowId }
      : { appUserId: student.appUserId! };
    if (!student.studentRowId && !student.appUserId) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const newVideo = await prisma.video.create({
      data: {
        ...owner,
        videoUrl, thumbnailUrl, caption, category, subCategory,
        tags: mergedTags,
        isPublic: wantsPublic,
        isEvaluation: true,
        // No MittFest checkbox on this form - the hashtag is the only way in.
        isMittfest: hasMittfestTag(tags),
        olympiadVisibility: wantsPublic ? 'public' : 'private',
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

function buildTags(schoolInfo: any, tags?: string): string {
  const autoTags: string[] = [];
  if (schoolInfo?.state)    autoTags.push(schoolInfo.state.replace(/\s+/g, ''));
  if (schoolInfo?.district) autoTags.push(schoolInfo.district.replace(/\s+/g, ''));
  if (schoolInfo?.name)     autoTags.push(schoolInfo.name.replace(/\s+/g, ''));
  if (schoolInfo?.schoolId) autoTags.push(schoolInfo.schoolId);
  const userTags = tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
  return [...new Set([...autoTags, ...userTags])].join(',');
}

// GET — list videos uploaded by this school
export async function GET(request: Request) {
  try {
    const school = getSchoolFromToken(request);
    if (!school) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videos = await prisma.video.findMany({
      where: { uploaderType: 'SCHOOL', student: { allocation: { schoolId: school.id } }, deletedAt: null },
      include: { student: { select: { id: true, name: true, olympiadCode: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(videos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
