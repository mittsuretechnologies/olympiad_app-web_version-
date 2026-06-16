import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { reviewerId, password } = await request.json();
    if (!reviewerId || !password)
      return NextResponse.json({ message: 'Reviewer ID and password required' }, { status: 400 });

    const reviewer = await prisma.reviewer.findUnique({
      where: { reviewerId: reviewerId.trim().toUpperCase() },
    });
    if (!reviewer)
      return NextResponse.json({ message: 'Invalid Reviewer ID or password' }, { status: 401 });
    if (!reviewer.isActive)
      return NextResponse.json({ message: 'Your account has been deactivated. Contact admin.' }, { status: 403 });

    const match = await bcrypt.compare(password, reviewer.password);
    if (!match)
      return NextResponse.json({ message: 'Invalid Reviewer ID or password' }, { status: 401 });

    const token = jwt.sign(
      { id: reviewer.id, reviewerId: reviewer.reviewerId, role: 'REVIEWER' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      token,
      reviewer: { id: reviewer.id, reviewerId: reviewer.reviewerId, name: reviewer.name, email: reviewer.email },
    });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
