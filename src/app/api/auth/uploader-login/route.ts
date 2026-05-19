import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json(
        { message: 'Username and password are required' },
        { status: 400 }
      );
    }

    const uploader = await prisma.uploader.findUnique({ where: { username } });
    if (!uploader || uploader.status !== 'ACTIVE') {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, uploader.password);
    if (!ok) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign(
      { id: uploader.id, uploaderId: uploader.uploaderId, role: 'UPLOADER' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id: uploader.id,
        uploaderId: uploader.uploaderId,
        name: uploader.name,
      },
    });
  } catch (error) {
    console.error('Uploader login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
