// One-off backfill: give every existing Olympiad school its app account.
//
// A school is opened in the mobile app as a profile, which is an AppUser
// (AppUser.schoolRefId -> School.id, see src/lib/schoolAccount.ts). New schools
// get theirs the first time they log in, or when someone opens their page, but
// a school that has never logged in has none yet - so Search, a reel's school
// tag and Home would have nothing to open. Run this once after deploying the
// migration 20261010000000_add_school_app_account.
//
// Safe to run again: schools that already have an account are skipped.
// Usage: node scripts/backfill-school-accounts.js
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    select: { id: true, username: true, schoolId: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  const existing = new Set(
    (await prisma.appUser.findMany({ where: { schoolRefId: { not: null } }, select: { schoolRefId: true } }))
      .map(u => u.schoolRefId),
  );

  let created = 0;
  let skipped = 0;
  for (const school of schools) {
    if (existing.has(school.id)) { skipped++; continue; }

    const base = (school.username || school.schoolId).trim();
    let userId = base;
    for (let i = 0; i < 5; i++) {
      const clash = await prisma.appUser.findFirst({
        where: { userId: { equals: userId, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!clash) break;
      userId = `${base}_${crypto.randomBytes(2).toString('hex')}`;
    }

    await prisma.appUser.create({
      data: {
        userId,
        // Never the way in: the app checks School.password for these accounts.
        password: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
        isVerified: true,
        accountType: 'SCHOOL',
        schoolRefId: school.id,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
      },
    });
    created++;
    console.log(`created app account "${userId}" for ${school.name} (${school.schoolId})`);
  }
  console.log(`Done. Created ${created}, already had one: ${skipped}, schools: ${schools.length}`);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
