import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

function generateReviewerId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `RVW${num}`;
}

export async function GET() {
  try {
    const reviewers = await prisma.reviewer.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, reviewerId: true, name: true, email: true, isActive: true, plainPassword: true, createdAt: true },
    });
    return NextResponse.json(reviewers);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();
    if (!name?.trim() || !email?.trim() || !password?.trim())
      return NextResponse.json({ message: 'name, email and password are required' }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });

    // Generate unique reviewerId
    let reviewerId = generateReviewerId();
    let attempt = 0;
    while (await prisma.reviewer.findUnique({ where: { reviewerId } })) {
      reviewerId = generateReviewerId();
      if (++attempt > 20) throw new Error('Could not generate unique reviewer ID');
    }

    const hash = await bcrypt.hash(password, 10);
    const reviewer = await prisma.reviewer.create({
      data: { reviewerId, name: name.trim(), email: email.trim().toLowerCase(), password: hash, plainPassword: password },
    });

    return NextResponse.json({ id: reviewer.id, reviewerId: reviewer.reviewerId, name: reviewer.name, email: reviewer.email }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Email already registered' }, { status: 409 });
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
