// Suspend / ban state of an AppUser (set by the Super Admin, see
// api/dashboard/app-users/[id]). A row is suspended while suspendedAt is set
// and either suspendedUntil is null (permanent ban) or still in the future.

type SuspensionFields = {
  suspendedAt?: Date | string | null;
  suspendedUntil?: Date | string | null;
  suspensionType?: string | null;
  suspensionReason?: string | null;
};

export function isSuspended(u: SuspensionFields, now: Date = new Date()): boolean {
  if (!u.suspendedAt) return false;
  if (!u.suspendedUntil) return true;
  return new Date(u.suspendedUntil).getTime() > now.getTime();
}

// Prisma `where` fragment matching every account suspended right now.
export function suspendedWhere(now: Date = new Date()) {
  return {
    suspendedAt: { not: null as null },
    OR: [{ suspendedUntil: null }, { suspendedUntil: { gt: now } }],
  };
}

export function suspensionMessage(u: SuspensionFields): string {
  const banned = !u.suspendedUntil;
  const reason = u.suspensionReason ? ` Reason: ${u.suspensionReason}` : '';
  if (banned) {
    return `Your account has been banned.${reason} Contact Mittmee support if you think this is a mistake.`;
  }
  const until = new Date(u.suspendedUntil as Date | string).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return `Your account is suspended until ${until}.${reason}`;
}
