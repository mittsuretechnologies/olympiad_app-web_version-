// Every MasterAdmin login name ends in this suffix, so it can never collide
// with a school username or a staff ID, and the login route can tell at a
// glance which table to look in.
export const MASTER_ADMIN_USERNAME_SUFFIX = '-master@mittmee';

// The part the SuperAdmin types before the suffix: e.g. "rohan.sharma".
const HANDLE_RE = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/;

export function normalizeMasterAdminHandle(raw: string): string {
  let handle = (raw || '').trim().toLowerCase();
  if (handle.endsWith(MASTER_ADMIN_USERNAME_SUFFIX)) handle = handle.slice(0, -MASTER_ADMIN_USERNAME_SUFFIX.length);
  return handle;
}

export function isValidMasterAdminHandle(handle: string): boolean {
  return handle.length >= 3 && handle.length <= 40 && HANDLE_RE.test(handle);
}

// "Rohan Kumar Sharma" -> "rohan.kumar.sharma" — the default handle the create
// form fills in from the Full Name. Accents are dropped; anything that isn't
// a-z / 0-9 splits words. Capped to the 40-char limit on a word boundary.
export function handleFromName(name: string): string {
  const words = (name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let handle = '';
  for (const w of words) {
    const next = handle ? `${handle}.${w}` : w;
    if (next.length > 40) break;
    handle = next;
  }
  return handle || (words[0] || '').slice(0, 40);
}

export function masterAdminUsername(handle: string): string {
  return `${handle}${MASTER_ADMIN_USERNAME_SUFFIX}`;
}

export function isMasterAdminUsername(identifier: string): boolean {
  return (identifier || '').trim().toLowerCase().endsWith(MASTER_ADMIN_USERNAME_SUFFIX);
}

// Prisma P2021 = table missing: the MasterAdmin migration
// (prisma/manual-migrations/2026-10-15-master-admin.sql) hasn't been run on
// this database yet. Shown instead of the raw Prisma error.
export const MASTER_ADMIN_TABLE_MISSING_MESSAGE =
  'Master Admin table is not in the database yet — run prisma/manual-migrations/2026-10-15-master-admin.sql first.';
