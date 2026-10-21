import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signAppUserToken } from '@/lib/appUserToken';
import { currentGeneralSchoolAcceptance } from '@/lib/generalSchool';
import { ensureSchoolAccount, currentOlympiadSchoolAcceptance, signSchoolToken } from '@/lib/schoolAccount';

export async function POST(request: Request) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json({ message: 'User ID and password are required' }, { status: 400 });
    }

    const typed = String(userId).trim();

    // The one login box accepts a username, an email or a 10-digit mobile number.
    // An email/mobile can be shared by sibling accounts, so the password decides
    // which of them is meant; if it fits more than one, the user is asked to sign
    // in with the username instead of guessing.
    const looksEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed);
    const typedDigits = typed.replace(/\D/g, '');
    const looksMobile = !looksEmail && /^[\d\s+\-()]+$/.test(typed) && /^(?:91)?[6-9]\d{9}$/.test(typedDigits);

    let user: Awaited<ReturnType<typeof prisma.appUser.findFirst>> = null;
    if (looksEmail || looksMobile) {
      const mobile = typedDigits.slice(-10);
      const candidates = await prisma.appUser.findMany({
        where: {
          isVerified: true,
          ...(looksEmail ? { email: { equals: typed, mode: 'insensitive' as const } } : { mobile }),
        },
      });
      const matches = [];
      for (const c of candidates) {
        if (c.password && await bcrypt.compare(password, c.password)) matches.push(c);
      }
      if (matches.length === 1) {
        user = matches[0];
      } else if (matches.length > 1) {
        // The password fits several sibling accounts: hand back who they are so
        // the app can ask which one to open (it then logs in with that username).
        const codes = matches.map((m) => m.olympiadId).filter((c): c is string => !!c);
        const allocations = codes.length
          ? await prisma.olympiadIdAllocation.findMany({
              where: { code: { in: codes } },
              select: { code: true, assignedName: true },
            })
          : [];
        const nameByCode = new Map(allocations.map((a) => [a.code, a.assignedName]));
        return NextResponse.json(
          {
            message: 'More than one account uses this email/mobile and password. Choose which one to open.',
            accounts: matches.map((m) => ({
              userId: m.userId,
              avatarUrl: m.avatarUrl,
              studentName: (m.olympiadId && nameByCode.get(m.olympiadId)) || null,
            })),
          },
          { status: 409 },
        );
      } else if (candidates.length > 0) {
        return NextResponse.json({ message: 'Incorrect password. Please try again.' }, { status: 401 });
      }
    }

    // Usernames are matched exactly, capitals included ("Binku" is not "binku").
    // New usernames can't differ from an existing one only by case (see
    // generateUserId and the username-change routes), so this never splits one
    // person across two accounts. Emails above stay case-insensitive.
    if (!user) {
      user = await prisma.appUser.findFirst({
        where: { userId: typed },
      });
    }

    // ---- Olympiad school ----------------------------------------------------
    // A school logs in with the username and password it uses on the web portal.
    // Either the typed name is the school's own app account (found above), or no
    // app user has that name and it is a School username. The password is always
    // checked against School.password - the app account has no usable password.
    let olympiadSchool = null as null | {
      id: string; schoolId: string; name: string; username: string | null;
      state: string | null; district: string | null; isActive: boolean; password: string | null;
      email: string | null; phone: string | null;
    };
    if (user?.schoolRefId) {
      olympiadSchool = await prisma.school.findUnique({
        where: { id: user.schoolRefId },
        select: { id: true, schoolId: true, name: true, username: true, state: true, district: true, isActive: true, password: true, email: true, phone: true },
      });
    } else if (!user) {
      olympiadSchool = await prisma.school.findFirst({
        where: { username: typed },
        select: { id: true, schoolId: true, name: true, username: true, state: true, district: true, isActive: true, password: true, email: true, phone: true },
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

      const token = signAppUserToken(account);

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
            email: olympiadSchool.email, mobile: olympiadSchool.phone,
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

    const token = signAppUserToken(user);

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
