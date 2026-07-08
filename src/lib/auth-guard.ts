import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export function requireRole(request: Request, allowedRoles: string[]) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  let payload: any;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
  } catch {
    return { error: NextResponse.json({ message: 'Invalid token' }, { status: 401 }) };
  }

  if (!allowedRoles.includes(payload?.role) || !payload?.id) {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
  }

  return { payload };
}
