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

// The school upload categories live in a client-safe file so the school
// portal's upload page can use the same list; re-exported here for the server.
// Same as a general user's Talent / Rhymes / Speech groups plus School
// Activity; Learning, Parenting and Others are not offered to schools.
export {
  SCHOOL_ACTIVITY_CATEGORY,
  SCHOOL_UPLOAD_CATEGORIES,
  SCHOOL_ACTIVITY_SUBS,
  isSchoolActivity,
} from '@/lib/schoolUploadCategories';

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

/**
 * Emails the school a copy of the accepted agreement with the acceptance
 * record (Section 18.4), exactly as the Olympiad School Panel does. A mail
 * failure never undoes the acceptance: it is already recorded, and the
 * Super Admin Agreements page shows whether the copy went out.
 * Returns the addresses the copy was sent to (empty if none).
 */
export async function emailGeneralSchoolAgreementCopy(input: {
  record: {
    id: string; acceptedAt: Date; signatoryDesignation: string; documentVersion: string;
    ipAddress: string | null; documentHash: string; declarations: unknown;
  };
  schoolName: string;
  schoolEmail: string | null | undefined;
  userId: string | null | undefined;
  verification: string;
}): Promise<string[]> {
  // Imported here so routes that only read schools don't load the mailer.
  const { sendAgreementCopyEmail } = await import('@/lib/mailer');
  const { isEmail, agreementEmailHtml, formatIst } = await import('@/lib/agreements/server');
  const { SCHOOL_AGREEMENT_TITLE, agreementPlainText } = await import('@/lib/agreements/school-onboarding');

  const { record, schoolName, schoolEmail, userId, verification } = input;
  const to = isEmail(schoolEmail) ? schoolEmail!.trim().toLowerCase() : null;
  if (!to) return [];
  const declarations = Array.isArray(record.declarations) ? (record.declarations as string[]) : [];
  try {
    await sendAgreementCopyEmail({
      to: [to],
      schoolName,
      agreementTitle: SCHOOL_AGREEMENT_TITLE,
      record: [
        { label: 'School', value: userId ? `${schoolName} (${userId})` : schoolName },
        { label: 'Accepted by', value: record.signatoryDesignation },
        { label: 'Accepted at', value: formatIst(record.acceptedAt) },
        { label: 'Agreement version', value: record.documentVersion },
        { label: 'Verification', value: verification },
        { label: 'IP address', value: record.ipAddress || '—' },
        { label: 'Declarations', value: declarations.map((d, i) => `(${i + 1}) ${d}`).join('  ') },
        { label: 'Document fingerprint (SHA-256)', value: record.documentHash },
      ],
      agreementHtml: agreementEmailHtml(),
      agreementText: agreementPlainText(),
      attachmentName: `${SCHOOL_AGREEMENT_TITLE} v${record.documentVersion} - ${userId || schoolName}.txt`,
    });
    await prisma.agreementAcceptance.update({
      where: { id: record.id },
      data: { emailCopyTo: to, emailCopySentAt: new Date() },
    });
    return [to];
  } catch (err) {
    console.error('Agreement copy email failed for general school', userId || schoolName, err);
    return [];
  }
}

/** The receipt the app shows after acceptance (same fields as the web gate). */
export const acceptanceReceipt = (r: {
  id: string; acceptedAt: Date; signatoryName: string; signatoryDesignation: string;
  documentVersion: string; ipAddress: string | null;
}) => ({
  id: r.id,
  acceptedAt: r.acceptedAt,
  signatoryName: r.signatoryName,
  signatoryDesignation: r.signatoryDesignation,
  documentVersion: r.documentVersion,
  ipAddress: r.ipAddress,
});
