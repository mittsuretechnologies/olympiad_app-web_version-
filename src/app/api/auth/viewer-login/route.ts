import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await prisma.viewer.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      // Returning viewer — verify password
      const ok = await bcrypt.compare(password, existing.password);
      if (!ok) {
        return NextResponse.json({ message: 'Invalid password' }, { status: 401 });
      }
      const token = jwt.sign(
        { id: existing.id, email: existing.email, role: 'VIEWER' },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '30d' }
      );
      return NextResponse.json({
        message: 'Login successful',
        token,
        isNew: false,
        user: { id: existing.id, email: existing.email, name: existing.name },
      });
    }

    // New viewer — register automatically
    const hashedPassword = await bcrypt.hash(password, 10);
    const viewer = await prisma.viewer.create({
      data: { email: normalizedEmail, password: hashedPassword },
    });

    const token = jwt.sign(
      { id: viewer.id, email: viewer.email, role: 'VIEWER' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      message: 'Account created and logged in',
      token,
      isNew: true,
      user: { id: viewer.id, email: viewer.email, name: viewer.name },
    });
  } catch (error) {
    console.error('Viewer login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
