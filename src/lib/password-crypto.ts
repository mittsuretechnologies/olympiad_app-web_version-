import crypto from 'crypto';

// Reversible encryption for the plainPassword columns (School, Student, AppUser,
// Uploader, Evaluator, Reviewer, Moderator, MasterReviewer). Admins need to be able
// to view/resend these credentials, so they can't be one-way hashed like the real
// login password — but storing them as raw text means a DB dump or backup leak
// hands out every account's live password. AES-256-GCM keeps them encrypted at
// rest; decrypting requires PASSWORD_ENCRYPTION_KEY, which lives only in the
// server environment, not the database.
//
// PASSWORD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes), e.g.
// generated once via: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const key = process.env.PASSWORD_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('PASSWORD_ENCRYPTION_KEY environment variable is not set');
  }
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) {
    throw new Error('PASSWORD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return buf;
}

// Stored format: "v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>"
export function encryptPassword(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptPassword(stored: string | null): string | null {
  if (!stored) return null;
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    // Pre-migration plaintext value — return as-is rather than throwing, so
    // existing rows keep working until they're next reset/re-encrypted.
    return stored;
  }
  const [, ivHex, authTagHex, dataHex] = parts;
  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
