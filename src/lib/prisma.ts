import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Local development should run on the local copy (.env.local-db). Say loudly
// when it is wired to production instead — the prod tunnel is port 5433.
if (process.env.NODE_ENV === 'development' && !(globalForPrisma as { warned?: boolean }).warned) {
  (globalForPrisma as { warned?: boolean }).warned = true;
  const target = (process.env.DATABASE_URL || '').replace(/^[^@]*@/, '').replace(/\?.*$/, '');
  if (/:5433\//.test(target)) {
    console.warn(`\n  !!! DEV SERVER IS USING THE PRODUCTION DATABASE (${target}) — every change is real !!!\n`);
  } else {
    console.log(`  Database: ${target}`);
  }
}
