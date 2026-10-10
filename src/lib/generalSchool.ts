import { prisma } from '@/lib/prisma';
import {
  SCHOOL_AGREEMENT_KEY,
  SCHOOL_AGREEMENT_VERSION,
} from '@/lib/agreements/school-onboarding';

/**
 * General Schools: schools that registered themselves in the mobile app.
 * See the GeneralSchool model in schema.prisma for how they differ from the
 * Olympiad `School` table (which they never touch).
 */

/** AgreementAcceptance.role for a General School's acceptance. Olympiad schools use "SCHOOL". */
export const GENERAL_SCHOOL_AGREEMENT_ROLE = 'GENERAL_SCHOOL';

export const ACCOUNT_TYPE_SCHOOL = 'SCHOOL';

/** uploaderType stored on a General School's own videos. */
export const UPLOADER_SCHOOL_OWN = 'SCHOOL_OWN';

export const SCHOOL_ACTIVITY_CATEGORY = 'School Activity';

/**
 * Categories a school account may upload into. Same as a general user's
 * Talent / Rhymes / Speech groups plus School Activity; Learning, Parenting
 * and Others are not offered to schools.
 */
export const SCHOOL_UPLOAD_CATEGORIES = [
  'Talent Performance',
  'Rhymes',
  'Speech & Presentation',
  SCHOOL_ACTIVITY_CATEGORY,
] as const;

/** The only sub-categories School Activity accepts. */
export const SCHOOL_ACTIVITY_SUBS = [
  'Annual Day',
  'Sports Day',
  'Classroom Activity',
  'Festival Celebration',
  'Competition',
  'Field Trip',
  'Other',
] as const;

export const isSchoolActivity = (category: unknown) =>
  typeof category === 'string' && category.trim().toLowerCase() === SCHOOL_ACTIVITY_CATEGORY.toLowerCase();

/**
 * The school's current acceptance: its newest unrevoked row for the current
 * agreement version. A Super Admin can revoke it (asking the school to accept
 * again); the revoked row stays as evidence.
 */
export function currentGeneralSchoolAcceptance(generalSchoolId: string) {
  return prisma.agreementAcceptance.findFirst({
    where: {
      role: GENERAL_SCHOOL_AGREEMENT_ROLE,
      actorId: generalSchoolId,
      documentKey: SCHOOL_AGREEMENT_KEY,
      documentVersion: SCHOOL_AGREEMENT_VERSION,
      revokedAt: null,
    },
    orderBy: { acceptedAt: 'desc' },
    select: {
      id: true, acceptedAt: true, signatoryName: true, signatoryDesignation: true,
      documentVersion: true, ipAddress: true,
    },
  });
}

/** Snapshot of the school's details, stored on the acceptance as legal evidence. */
export const generalSchoolDetailsSnapshot = (s: {
  name: string; email: string; mobile: string; state: string; district: string;
  city?: string | null; pincode?: string | null; address?: string | null; userId?: string;
}) => ({
  schoolName: s.name,
  schoolCode: s.userId ?? '',
  address: s.address ?? '',
  city: s.city ?? '',
  district: s.district,
  state: s.state,
  pincode: s.pincode ?? '',
  officialEmail: s.email,
  phone: s.mobile,
});

/** Client-reported reading timestamps: kept only when plausible. */
export function plausibleDate(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  return t <= now + 5 * 60_000 && t >= now - 24 * 3_600_000 ? d : null;
}

/**
 * Loads the General School behind an app user, or null for any ordinary
 * account. Used by routes that must behave differently for schools.
 */
export function getGeneralSchoolForUser(appUserId: string) {
  return prisma.generalSchool.findUnique({
    where: { appUserId },
    select: {
      id: true, name: true, email: true, mobile: true, contactPerson: true,
      state: true, district: true, city: true, pincode: true, address: true, isActive: true,
    },
  });
}
