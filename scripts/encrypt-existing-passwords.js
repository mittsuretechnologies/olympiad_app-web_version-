// One-time backfill: encrypt plainPassword values that are still stored as raw
// text. Safe to re-run — rows already in the "v1:" format are skipped.
//
// Usage (PASSWORD_ENCRYPTION_KEY must match the app's):
//   node scripts/encrypt-existing-passwords.js          # dry run, reports counts
//   node scripts/encrypt-existing-passwords.js --apply  # performs the writes

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey() {
  const key = process.env.PASSWORD_ENCRYPTION_KEY;
  if (!key) throw new Error('PASSWORD_ENCRYPTION_KEY is not set');
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) throw new Error('PASSWORD_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return buf;
}

function encryptPassword(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}

const MODELS = [
  'school', 'student', 'appUser', 'uploader',
  'talentEvaluator', 'reviewer', 'moderator', 'masterReviewer',
];

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  getKey(); // fail fast before touching the DB

  let totalEncrypted = 0;
  let totalSkipped = 0;

  for (const model of MODELS) {
    const rows = await prisma[model].findMany({
      where: { plainPassword: { not: null } },
      select: { id: true, plainPassword: true },
    });

    const pending = rows.filter((r) => !r.plainPassword.startsWith('v1:'));
    totalSkipped += rows.length - pending.length;

    if (apply) {
      for (const row of pending) {
        await prisma[model].update({
          where: { id: row.id },
          data: { plainPassword: encryptPassword(row.plainPassword) },
        });
      }
    }

    totalEncrypted += pending.length;
    console.log(`${model}: ${pending.length} to encrypt, ${rows.length - pending.length} already encrypted`);
  }

  console.log(
    apply
      ? `\nDone. Encrypted ${totalEncrypted} rows, skipped ${totalSkipped} already-encrypted.`
      : `\nDry run. ${totalEncrypted} rows would be encrypted, ${totalSkipped} already encrypted.\nRe-run with --apply to write.`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
