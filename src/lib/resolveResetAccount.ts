import { prisma } from '@/lib/prisma';

export function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

export function isMobile(val: string): boolean {
  return /^[6-9]\d{9}$/.test(val);
}

export type ResetAccount =
  | { kind: 'APP_USER'; id: string; otpIdentifier: string }
  | { kind: 'STUDENT'; id: string; otpIdentifier: string };

/**
 * Resolves a forgot-password identifier (email or mobile) to the matching
 * AppUser or Student account. Emails only ever match AppUser (Student has
 * no email field). Mobile numbers check AppUser.mobile first — this covers
 * both self-signed-up viewers and school-issued students, who are stored
 * as AppUser rows with olympiadId set (see /api/school/me/olympiad-ids/allot).
 * Falls back to the separate, legacy Student.phone (not unique in the
 * schema — first match wins) for the older self-registration path.
 */
export async function resolveResetAccount(identifier: string): Promise<ResetAccount | null> {
  const id = identifier.trim().toLowerCase();
  const type = isEmail(id) ? 'email' : isMobile(id.replace(/\D/g, '')) ? 'mobile' : null;
  if (!type) return null;

  if (type === 'email') {
    const user = await prisma.appUser.findFirst({ where: { email: id, isVerified: true } });
    if (!user) return null;
    return { kind: 'APP_USER', id: user.id, otpIdentifier: id };
  }

  const mobile = id.replace(/\D/g, '');

  const appUser = await prisma.appUser.findFirst({ where: { mobile, isVerified: true } });
  if (appUser) {
    return { kind: 'APP_USER', id: appUser.id, otpIdentifier: mobile };
  }

  const studentCandidates = await prisma.student.findMany({
    where: { isVerified: true, phone: { contains: mobile } },
  });
  const student = studentCandidates.find(s => s.phone.replace(/\D/g, '') === mobile);
  if (student) {
    return { kind: 'STUDENT', id: student.id, otpIdentifier: `student:${student.olympiadCode}` };
  }

  return null;
}
