import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/jwt-secret';

// Login token for the mobile app (role APP_USER). No expiry on purpose: an
// app session stays signed in until the user logs out. It still ends when
// the account is deleted or its school is deactivated — /app/me answers
// 401/404 then, and the app logs out.
export function signAppUserToken(user: { id: string; userId: string }) {
  return jwt.sign({ id: user.id, userId: user.userId, role: 'APP_USER' }, getJwtSecret());
}
