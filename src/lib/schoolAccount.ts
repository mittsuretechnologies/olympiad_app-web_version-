import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { schoolAutoTags } from '@/lib/videoAutoTags';
import { SCHOOL_AGREEMENT_KEY, SCHOOL_AGREEMENT_VERSION } from '@/lib/agreements/school-onboarding';
import { ACCOUNT_TYPE_SCHOOL, currentGeneralSchoolAcceptance, getGeneralSchoolForUser } from '@/lib/generalSchool';

/**
 * Olympiad schools inside the mobile app.
 *
 * Everything in the app (feed, follow, like, search, notifications, uploads) is
 * built around AppUser. An Olympiad school logs in with the same username and
 * password as the web portal, which live on the School row. So each school gets
 * one AppUser that stands in for it (AppUser.schoolRefId -> School.id,
 * accountType "SCHOOL"). That account never authenticates by its own password:
 * the login route checks School.password. It carries no email or mobile, so the
 * forgot-password flow can never match it.
 *
 * A school logging in on the app receives two tokens: the normal app token
 * (role APP_USER, id = this account) and a school token (role SCHOOL, id =
 * School.id) that the existing /api/school/me/* routes already accept.
 */

type SchoolRow = { id: string; username: string | null; schoolId: string; name: string };

/**
 * Returns the app account for a school, creating it if it does not exist yet.
 * Safe to call repeatedly and from parallel requests.
 */
export async function ensureSchoolAccount(school: SchoolRow) {
  const existing = await prisma.appUser.findUnique({ where: { schoolRefId: school.id } });
  if (existing) return existing;

  const base = (school.username || school.schoolId).trim();
  // The login box is shared with ordinary app users, whose IDs are unique
  // case-insensitively. If an ordinary user already holds this ID, the school
  // gets a suffixed one; the school logs in through the School username anyway.
  let userId = base;
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.appUser.findFirst({
      where: { userId: { equals: userId, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!clash) break;
    userId = `${base}_${crypto.randomBytes(2).toString('hex')}`;
  }

  // Unusable password: never the way in for this account.
  const unusable = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

  try {
    return await prisma.appUser.create({
      data: {
        userId,
        password: unusable,
        isVerified: true,
        accountType: ACCOUNT_TYPE_SCHOOL,
        schoolRefId: school.id,
        // The school accepted its Terms through the School Onboarding Agreement.
        termsAccepted: true,
        termsAcceptedAt: new Date(),
      },
    });
  } catch (err: any) {
    // Two requests raced to create it - the other one won.
    if (err?.code === 'P2002') {
      const winner = await prisma.appUser.findUnique({ where: { schoolRefId: school.id } });
      if (winner) return winner;
    }
    throw err;
  }
}

/** School.id -> app account id for many schools at once (creating missing accounts). */
export async function schoolAccountIds(
  schools: SchoolRow[],
): Promise<Map<string, string>> {
  if (schools.length === 0) return new Map();
  const found = await prisma.appUser.findMany({
    where: { schoolRefId: { in: schools.map(s => s.id) } },
    select: { id: true, schoolRefId: true },
  });
  const map = new Map(found.map(u => [u.schoolRefId!, u.id]));
  for (const s of schools) {
    if (!map.has(s.id)) map.set(s.id, (await ensureSchoolAccount(s)).id);
  }
  return map;
}

/** A school's current acceptance of the School Onboarding Agreement (web and app share it). */
export function currentOlympiadSchoolAcceptance(schoolId: string) {
  return prisma.agreementAcceptance.findFirst({
    where: {
      role: 'SCHOOL', actorId: schoolId,
      documentKey: SCHOOL_AGREEMENT_KEY, documentVersion: SCHOOL_AGREEMENT_VERSION,
      revokedAt: null,
    },
    orderBy: { acceptedAt: 'desc' },
    select: { id: true },
  });
}

/** Token the existing school routes accept. 30 days: the app refreshes it through /api/app/me. */
export function signSchoolToken(school: { id: string; schoolId: string }) {
  return jwt.sign(
    { id: school.id, schoolId: school.schoolId, role: 'SCHOOL' },
    getJwtSecret(),
    { expiresIn: '30d' },
  );
}

export type SchoolIdentity = {
  kind: 'GENERAL' | 'OLYMPIAD';
  /** GeneralSchool.id or School.id */
  schoolRowId: string;
  name: string;
  state: string | null;
  district: string | null;
  isActive: boolean;
  agreementAccepted: boolean;
  /** Hashtags every upload from this school carries (state, district, name, code). */
  autoTags: string[];
};

const squash = (v: string) => v.replace(/\s+/g, '');

/**
 * Who a school account is, whichever kind it is. Null for an ordinary user.
 * Used wherever behaviour is the same for both kinds of school (uploading its
 * own videos, the agreement gate, being switched off).
 */
export async function getSchoolIdentity(appUserId: string): Promise<SchoolIdentity | null> {
  const user = await prisma.appUser.findUnique({
    where: { id: appUserId },
    select: { accountType: true, schoolRefId: true },
  });
  if (!user || user.accountType !== ACCOUNT_TYPE_SCHOOL) return null;

  if (user.schoolRefId) {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolRefId },
      select: { id: true, olympiadId: true, name: true, state: true, district: true, isActive: true },
    });
    if (!school) return null;
    const accepted = await currentOlympiadSchoolAcceptance(school.id);
    // The CRM ID tag is what the "videos from this school" counts match on
    // (see schoolTagWhere in lib/videoAutoTags).
    const autoTags = schoolAutoTags(school);
    return {
      kind: 'OLYMPIAD', schoolRowId: school.id, name: school.name, state: school.state,
      district: school.district, isActive: school.isActive, agreementAccepted: Boolean(accepted), autoTags,
    };
  }

  const general = await getGeneralSchoolForUser(appUserId);
  if (!general) return null;
  const accepted = await currentGeneralSchoolAcceptance(general.id);
  const autoTags: string[] = [];
  if (general.state)    autoTags.push(squash(general.state));
  if (general.district) autoTags.push(squash(general.district));
  autoTags.push(squash(general.name));
  return {
    kind: 'GENERAL', schoolRowId: general.id, name: general.name, state: general.state,
    district: general.district, isActive: general.isActive, agreementAccepted: Boolean(accepted), autoTags,
  };
}
