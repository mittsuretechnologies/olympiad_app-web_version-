import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { currentGeneralSchoolAcceptance } from '@/lib/generalSchool';
import { ensureSchoolAccount, currentOlympiadSchoolAcceptance, signSchoolToken } from '@/lib/schoolAccount';

export async function POST(request: Request) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json({ message: 'User ID and password are required' }, { status: 400 });
    }

    const typed = String(userId).trim();

    let user = await prisma.appUser.findFirst({
      where: { userId: { equals: typed, mode: 'insensitive' } },
    });

    // ---- Olympiad school ----------------------------------------------------
    // A school logs in with the username and password it uses on the web portal.
    // Either the typed name is the school's own app account (found above), or no
    // app user has that name and it is a School username. The password is always
    // checked against School.password - the app account has no usable password.
    let olympiadSchool = null as null | {
      id: string; schoolId: string; name: string; username: string | null;
      state: string | null; district: string | null; isActive: boolean; password: string | null;
    };
    if (user?.schoolRefId) {
      olympiadSchool = await prisma.school.findUnique({
        where: { id: user.schoolRefId },
        select: { id: true, schoolId: true, name: true, username: true, state: true, district: true, isActive: true, password: true },
      });
    } else if (!user) {
      olympiadSchool = await prisma.school.findFirst({
        where: { username: { equals: typed, mode: 'insensitive' } },
        select: { id: true, schoolId: true, name: true, username: true, state: true, district: true, isActive: true, password: true },
      });
    }

    if (olympiadSchool) {
      if (!olympiadSchool.password || !(await bcrypt.compare(password, olympiadSchool.password))) {
        return NextResponse.json({ message: 'Incorrect password. Please try again.' }, { status: 401 });
      }
      if (!olympiadSchool.isActive) {
        return NextResponse.json({ message: 'Your account has been deactivated. Contact admin.' }, { status: 403 });
      }

      const account = user ?? await ensureSchoolAccount(olympiadSchool);
      await prisma.appUser.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
      const accepted = await currentOlympiadSchoolAcceptance(olympiadSchool.id);

      const token = jwt.sign(
        { id: account.id, userId: account.userId, role: 'APP_USER' },
        getJwtSecret(),
        { expiresIn: '30d' },
      );

      return NextResponse.json({
        message: 'Login successful',
        token,
        // For the school-only routes (student list, student videos, uploads for
        // a student, link requests). Refreshed by /api/app/me.
        schoolToken: signSchoolToken(olympiadSchool),
        user: {
          id:         account.id,
          userId:     account.userId,
          email:      null,
          mobile:     null,
          avatarUrl:  account.avatarUrl,
          olympiadId: null,
          isPrivate:  account.isPrivate,
          termsAccepted: true,
          mustChangePassword: false,
          studentName: null,
          school: null,
          accountType: 'SCHOOL',
          schoolProfile: {
            kind: 'OLYMPIAD',
            id: olympiadSchool.id, name: olympiadSchool.name,
            state: olympiadSchool.state, district: olympiadSchool.district,
            agreementAccepted: Boolean(accepted),
          },
        },
      });
    }

    // ---- Everyone else (users, students, General Schools) ----------------------
    if (!user) {
      return NextResponse.json(
        { message: `No account found with User ID "${typed}". Please check your ID or sign up.` },
        { status: 401 }
      );
    }
    if (!user.isVerified) {
      return NextResponse.json(
        { message: 'Account not fully registered. Please complete signup.' },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json({ message: 'Incorrect password. Please try again.' }, { status: 401 });
    }

    // A General School the Super Admin switched off cannot log in. Checked
    // before lastLoginAt / deletion-flag updates so a blocked attempt changes
    // nothing on the account.
    const generalSchool = user.accountType === 'SCHOOL'
      ? await prisma.generalSchool.findUnique({
          where:  { appUserId: user.id },
          select: { id: true, name: true, state: true, district: true, isActive: true },
        })
      : null;
    if (generalSchool && !generalSchool.isActive) {
      return NextResponse.json(
        { message: 'Your school account has been deactivated. Please contact Mittmee support.' },
        { status: 403 },
      );
    }
    const schoolAgreement = generalSchool ? await currentGeneralSchoolAcceptance(generalSchool.id) : null;

    // Logging in cancels a viewer's pending 30-day deletion — "everything
    // should work normally as it was before" is exactly this: clear the flag
    // and the account/videos are visible again immediately (visibilityWhere
    // only hides accounts where this is still set).
    await prisma.appUser.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date(), deletionRequestedAt: null },
    });

    const token = jwt.sign(
      { id: user.id, userId: user.userId, role: 'APP_USER' },
      getJwtSecret(),
      { expiresIn: '30d' }
    );

    // Resolve student name and school from olympiadId allocation
    let studentName: string | null = null;
    let school: { id: string; name: string | null; state: string | null; district: string | null; schoolId: string } | null = null;
    if (user.olympiadId) {
      const allocation = await prisma.olympiadIdAllocation.findUnique({
        where:  { code: user.olympiadId },
        select: {
          assignedName: true,
          school:  { select: { id: true, name: true, state: true, district: true, schoolId: true } },
          student: { select: { name: true } },
        },
      });
      studentName = allocation?.student?.name ?? allocation?.assignedName ?? null;
      if (allocation?.school) school = allocation.school;
    }

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id:         user.id,
        userId:     user.userId,
        email:      user.email,
        mobile:     user.mobile,
        avatarUrl:  user.avatarUrl,
        olympiadId: user.olympiadId,
        isPrivate:  user.isPrivate,
        termsAccepted: user.termsAccepted,
        mustChangePassword: user.mustChangePassword,
        studentName,
        school,
        accountType: user.accountType,
        schoolProfile: generalSchool
          ? {
              kind: 'GENERAL',
              id: generalSchool.id, name: generalSchool.name,
              state: generalSchool.state, district: generalSchool.district,
              agreementAccepted: Boolean(schoolAgreement),
            }
          : null,
      },
    });
  } catch (error) {
    console.error('app-login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
