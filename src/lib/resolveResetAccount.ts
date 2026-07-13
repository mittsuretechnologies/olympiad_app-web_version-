import { prisma } from '@/lib/prisma';

export function isEmail(val: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

export function isMobile(val: string): boolean {
  return /^[6-9]\d{9}$/.test(val);
}

export type ResetAccount = {
  kind: 'APP_USER' | 'STUDENT';
  id: string;
  otpIdentifier: string;
  label: string;
  studentName: string | null;
};

async function toAppUserAccount(
  user: { id: string; userId: string; olympiadId: string | null },
  otpIdentifier: string
): Promise<ResetAccount> {
  let studentName: string | null = null;
  if (user.olympiadId) {
    const allocation = await prisma.olympiadIdAllocation.findUnique({
      where: { code: user.olympiadId },
      select: { assignedName: true, student: { select: { name: true } } },
    });
    studentName = allocation?.student?.name ?? allocation?.assignedName ?? null;
  }
  return { kind: 'APP_USER', id: user.id, otpIdentifier, label: user.userId, studentName };
}

/**
 * Resolves a forgot-password identifier (email or mobile) to every matching
 * account — email/mobile can be shared by sibling AppUser accounts, so more
 * than one may come back. Emails only ever match AppUser (Student has no
 * email field). Mobile numbers check AppUser.mobile first — this covers both
 * self-signed-up viewers and school-issued students, who are stored as
 * AppUser rows with olympiadId set (see /api/school/me/olympiad-ids/allot).
 * Falls back to the separate, legacy Student.phone (not unique in the
 * schema — first exact match wins) only when no AppUser matches, since that
 * older self-registration path never supported sibling accounts.
 */
export async function resolveResetAccounts(identifier: string): Promise<ResetAccount[]> {
  const id = identifier.trim().toLowerCase();
  const type = isEmail(id) ? 'email' : isMobile(id.replace(/\D/g, '')) ? 'mobile' : null;
  if (!type) return [];

  if (type === 'email') {
    const users = await prisma.appUser.findMany({ where: { email: id, isVerified: true } });
    return Promise.all(users.map((u) => toAppUserAccount(u, id)));
  }

  const mobile = id.replace(/\D/g, '');

  const users = await prisma.appUser.findMany({ where: { mobile, isVerified: true } });
  if (users.length > 0) {
    return Promise.all(users.map((u) => toAppUserAccount(u, mobile)));
  }

  const studentCandidates = await prisma.student.findMany({
    where: { isVerified: true, phone: { contains: mobile } },
  });
  const student = studentCandidates.find((s) => s.phone.replace(/\D/g, '') === mobile);
  if (!student) return [];

  return [{
    kind: 'STUDENT',
    id: student.id,
    otpIdentifier: `student:${student.olympiadCode}`,
    label: student.username ?? student.name,
    studentName: student.name,
  }];
}
