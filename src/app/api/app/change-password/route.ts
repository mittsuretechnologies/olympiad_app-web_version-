import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { encryptPassword } from '@/lib/password-crypto';

// POST /api/app/change-password — body: { currentPassword?, newPassword }
// currentPassword may be omitted only while mustChangePassword is set: that is
// the first-login screen, reached straight after logging in with the issued
// password, so asking for it again adds nothing.
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') || '';
  let payload: any = null;
  try {
    payload = authHeader.startsWith('Bearer ') ? verify(authHeader.slice(7), getJwtSecret()) : null;
  } catch { /* falls through to 401 */ }
  if (payload?.role !== 'APP_USER' || !payload?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });
    }
    if (newPassword.length > 100) {
      return NextResponse.json({ message: 'Password is too long' }, { status: 400 });
    }

    const user = await prisma.appUser.findUnique({
      where: { id: payload.id },
      select: { id: true, password: true, mustChangePassword: true },
    });
    if (!user) return NextResponse.json({ message: 'Account not found' }, { status: 404 });

    if (!user.mustChangePassword) {
      if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, user.password))) {
        return NextResponse.json({ message: 'Current password is incorrect' }, { status: 401 });
      }
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      return NextResponse.json({ message: 'Choose a password different from the one you were given' }, { status: 400 });
    }

    await prisma.appUser.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(newPassword, 10),
        plainPassword: encryptPassword(newPassword),
        mustChangePassword: false,
      },
    });

    return NextResponse.json({ success: true, mustChangePassword: false });
  } catch (error) {
    console.error('app/change-password error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
