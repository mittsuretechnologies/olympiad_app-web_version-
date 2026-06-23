import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function PATCH(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const { userId, email, mobile, avatarUrl, isPrivate } = body;

  if (
    userId === undefined && email === undefined && mobile === undefined &&
    avatarUrl === undefined && isPrivate === undefined
  ) {
    return NextResponse.json({ message: 'No fields to update' }, { status: 400 });
  }

  // Validate userId: 3-20 chars, alphanumeric only, stored uppercase
  if (userId !== undefined) {
    const trimmed = userId.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      return NextResponse.json({ message: 'User ID must be between 3 and 20 characters' }, { status: 422 });
    }
    if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
      return NextResponse.json({ message: 'User ID can only contain letters and numbers' }, { status: 422 });
    }
    // Uniqueness check is case-insensitive — stored as-is but compared case-insensitively
    const existing = await prisma.appUser.findFirst({
      where: {
        userId: { equals: trimmed, mode: 'insensitive' },
        NOT: { id: appUser.id },
      },
    });
    if (existing) {
      return NextResponse.json({ message: 'This User ID is already taken' }, { status: 409 });
    }
  }

  // Validate email
  if (email !== undefined && email !== null && email !== '') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ message: 'Invalid email address' }, { status: 422 });
    }
    const existing = await prisma.appUser.findFirst({
      where: { email: email.trim(), NOT: { id: appUser.id } },
    });
    if (existing) {
      return NextResponse.json({ message: 'Email is already in use' }, { status: 409 });
    }
  }

  // Validate mobile: exactly 10 digits
  if (mobile !== undefined && mobile !== null && mobile !== '') {
    if (!/^\d{10}$/.test(mobile.trim())) {
      return NextResponse.json({ message: 'Mobile number must be exactly 10 digits' }, { status: 422 });
    }
    const existing = await prisma.appUser.findFirst({
      where: { mobile: mobile.trim(), NOT: { id: appUser.id } },
    });
    if (existing) {
      return NextResponse.json({ message: 'Mobile number is already in use' }, { status: 409 });
    }
  }

  const data: Record<string, any> = {};
  if (userId !== undefined)    data.userId    = userId.trim();
  if (email !== undefined)     data.email     = email?.trim()  || null;
  if (mobile !== undefined)    data.mobile    = mobile?.trim() || null;
  if (avatarUrl !== undefined) data.avatarUrl = avatarUrl      || null;
  if (isPrivate !== undefined) data.isPrivate = Boolean(isPrivate);

  try {
    const updated = await prisma.appUser.update({
      where: { id: appUser.id },
      data,
      select: {
        id:        true,
        userId:    true,
        email:     true,
        mobile:    true,
        avatarUrl: true,
        olympiadId: true,
        isPrivate:  true,
      },
    });

    return NextResponse.json({ user: updated }, { status: 200 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      return NextResponse.json({ message: `${field} is already in use` }, { status: 409 });
    }
    console.error('profile update error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
