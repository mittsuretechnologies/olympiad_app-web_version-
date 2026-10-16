import { randomInt } from 'crypto';

// Server-only (node crypto) — kept out of lib/masterAdmin.ts, which the
// dashboard pages import for the username suffix.

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

// "Auto password": 10 characters, no look-alikes (0/O, 1/l/I), always ending
// in a digit so it reads as letters-and-numbers.
export function generateMasterAdminPassword(): string {
  let out = '';
  for (let i = 0; i < 9; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out + String(randomInt(2, 10));
}
