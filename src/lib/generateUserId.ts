import { prisma } from './prisma';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSuffix(len = 4): string {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // remove spaces, special chars
    .slice(0, 12);              // max 12 chars from name
}

export async function generateUserId(assignedName?: string | null): Promise<string> {
  // A name made only of characters the slug drops (e.g. written in Hindi)
  // falls back to "user" rather than leaving the username as just "_ab12".
  // No name at all (the old single-field signup) keeps the original prefix.
  const base = assignedName?.trim()
    ? slugifyName(assignedName.trim()) || 'user'
    : 'mittsure';

  let attempt = 0;
  while (attempt < 20) {
    const suffix = randomSuffix(4);
    const userId = `${base}_${suffix}`;
    const exists = await prisma.appUser.findUnique({ where: { userId } });
    if (!exists) return userId;
    attempt++;
  }

  // Fallback — longer suffix to guarantee uniqueness
  return `${base}_${randomSuffix(8)}`;
}
