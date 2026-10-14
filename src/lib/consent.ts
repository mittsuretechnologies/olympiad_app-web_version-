import { prisma } from '@/lib/prisma';
import { clientIp, maskEmail, maskPhone, userAgent } from '@/lib/agreements/server';

// Consent records for app users (Privacy Policy 3 "Consent records";
// Children's Privacy Policy 3.3): who consented, to which document and
// version, how, when — and any withdrawal. Modelled on AgreementAcceptance.
//
// The documents an app user agrees to: the Terms of Use, and the policies it
// incorporates (Terms of Use 1.3; listed with it in the app's signup sheet and
// first-login terms screen — see Olympiad_App PolicyLinks.js). Each is
// published at https://www.mittmee.com<path>.
//
// version = the document's "Last updated" date. ANY change to a document's
// wording on the website must bump its "Last updated" date AND the version
// here, so the record shows which wording was accepted.
export const CONSENT_DOCUMENTS = [
  { key: 'TERMS_OF_USE',             title: 'Terms of Use',                          path: '/terms-of-use',                          version: '2026-10-01' },
  { key: 'TERMS_CHILDREN_PARENT',    title: 'Terms of Use for Children and Parent',  path: '/terms-of-use-for-children-and-parent',  version: '2026-10-01' },
  { key: 'PRIVACY_POLICY',           title: 'Privacy Policy',                        path: '/privacy-policy',                        version: '2026-10-01' },
  { key: 'CHILDRENS_PRIVACY_POLICY', title: "Children's Privacy Policy",             path: '/childrens-privacy-policy',              version: '2026-10-01' },
  { key: 'COMMUNITY_GUIDELINES',     title: 'Community Guidelines',                  path: '/community-guidelines',                  version: '2026-10-01' },
  { key: 'COPYRIGHT_POLICY',         title: 'Copyright and IP Policy',               path: '/copyright-and-ip-policy',               version: '2026-10-01' },
  { key: 'INFRINGEMENT_POLICY',      title: 'Infringement Policy',                   path: '/infringement-policy',                   version: '2026-10-01' },
  { key: 'ACCOUNT_DELETION_POLICY',  title: 'Account Deletion Policy',               path: '/account-deletion-policy',               version: '2026-10-07' },
] as const;

export type ConsentMethod =
  | 'SIGNUP_CHECKBOX'   // ticked "I agree to the Terms of Use & Policies" at app sign-up
  | 'SIGNUP_IMPLIED'    // sign-up from an old app build that sends no checkbox value
  | 'TERMS_GATE'        // tapped "I Agree" on the first-login terms screen (Olympiad accounts)
  | 'LEGACY_BACKFILL';  // from AppUser.termsAcceptedAt, before this table existed

export type VerificationChannel = 'SMS_OTP' | 'EMAIL_OTP' | 'PASSWORD_LOGIN';

type Db = Pick<typeof prisma, 'consentRecord'>;

export interface ConsentInput {
  appUserId: string;
  userHandle: string;            // AppUser.userId at the time
  consentedByName: string | null; // the parent/guardian giving consent, when known
  method: ConsentMethod;
  verificationChannel: VerificationChannel;
  verificationTarget: string | null; // the OTP'd phone/email (masked before storing)
  request: Request;
}

const mask = (target: string | null) => (target ? (target.includes('@') ? maskEmail(target) : maskPhone(target)) : null);

// One row per document. Skips documents whose current version this user
// already has an unwithdrawn record for, so repeating the action is harmless.
// Pass a transaction client to make the record part of the same commit.
export async function recordConsent(input: ConsentInput, db: Db = prisma) {
  const existing = await db.consentRecord.findMany({
    where: { appUserId: input.appUserId, withdrawnAt: null },
    select: { documentKey: true, documentVersion: true },
  });
  const have = new Set(existing.map((r) => `${r.documentKey}@${r.documentVersion}`));
  const docs = CONSENT_DOCUMENTS.filter((d) => !have.has(`${d.key}@${d.version}`));
  if (docs.length === 0) return 0;

  const now = new Date();
  const { count } = await db.consentRecord.createMany({
    data: docs.map((d) => ({
      appUserId: input.appUserId,
      userHandle: input.userHandle,
      consentedByName: input.consentedByName,
      documentKey: d.key,
      documentVersion: d.version,
      documentUrl: `https://www.mittmee.com${d.path}`,
      method: input.method,
      verificationChannel: input.verificationChannel,
      verificationTarget: mask(input.verificationTarget),
      ipAddress: clientIp(input.request),
      userAgent: userAgent(input.request),
      consentedAt: now,
    })),
  });
  return count;
}

// Withdrawal (Privacy Policy 11.3; Children's Privacy Policy 11): stamps every
// open record. Rows are kept as evidence of what was consented to and when.
export async function withdrawConsent(appUserId: string, by: { id: string; name: string | null }, reason: string) {
  const { count } = await prisma.consentRecord.updateMany({
    where: { appUserId, withdrawnAt: null },
    data: { withdrawnAt: new Date(), withdrawnById: by.id, withdrawnByName: by.name, withdrawalReason: reason },
  });
  return count;
}
