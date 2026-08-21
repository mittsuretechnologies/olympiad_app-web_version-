import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getLinkedSchoolForUser } from '@/lib/schoolMembers';

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

export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.appUser.findUnique({
      where: { id: appUser.id },
      select: {
        id:           true,
        userId:       true,
        email:        true,
        mobile:       true,
        avatarUrl:    true,
        olympiadId:   true,
        isVerified:   true,
        isPrivate:    true,
        termsAccepted: true,
        unlistedSchoolName: true,
        createdAt:    true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // If user has an olympiadId, resolve the linked school and student name
    // Prefer Student.name, fall back to allocation.assignedName (set by school admin)
    let school: { id: string; name: string | null; state: string | null; district: string | null; schoolId: string } | null = null;
    // OLYMPIAD when the school comes from an Olympiad ID allocation, LINKED when
    // it comes from a request the school approved, UNLISTED when the user only
    // typed a name for a school that is not on Mittmee, NONE when unset.
    let schoolLinkType: 'OLYMPIAD' | 'LINKED' | 'UNLISTED' | 'NONE' = 'NONE';
    let studentName: string | null = null;
    let classCode:   string | null = null;
    let className:   string | null = null;
    if (user.olympiadId) {
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where:  { code: user.olympiadId },
        select: {
          assignedName: true,
          classCode:    true,
          className:    true,
          school:  { select: { id: true, name: true, state: true, district: true, schoolId: true } },
          student: { select: { name: true } },
        },
      });
      if (allocation?.school) {
        school = allocation.school;
        schoolLinkType = 'OLYMPIAD';
      }
      studentName = allocation?.student?.name ?? allocation?.assignedName ?? null;
      classCode   = allocation?.classCode ?? null;
      className   = allocation?.className ?? null;
    }

    // No Olympiad ID: fall back to a school that approved this user's request.
    if (!school) {
      const linked = await getLinkedSchoolForUser(user.id);
      if (linked) {
        school = { id: linked.id, name: linked.name, state: linked.state, district: linked.district, schoolId: linked.schoolId };
        schoolLinkType = 'LINKED';
      } else if (user.unlistedSchoolName) {
        schoolLinkType = 'UNLISTED';
      }
    }

    return NextResponse.json({ user, school, schoolLinkType, studentName, classCode, className });
  } catch (error: any) {
    console.error('app/me error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
