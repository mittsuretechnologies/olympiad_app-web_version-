import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

function generateMasterReviewerId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `MRV${num}`;
}

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const masterReviewers = await prisma.masterReviewer.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, masterReviewerId: true, name: true, email: true, isActive: true, plainPassword: true, createdAt: true },
    });
    return NextResponse.json(masterReviewers);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { name, email, password } = await request.json();
    if (!name?.trim() || !email?.trim() || !password?.trim())
      return NextResponse.json({ message: 'name, email and password are required' }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ message: 'Password must be at least 6 characters' }, { status: 400 });

    // Generate unique masterReviewerId
    let masterReviewerId = generateMasterReviewerId();
    let attempt = 0;
    while (await prisma.masterReviewer.findUnique({ where: { masterReviewerId } })) {
      masterReviewerId = generateMasterReviewerId();
      if (++attempt > 20) throw new Error('Could not generate unique master reviewer ID');
    }

    const hash = await bcrypt.hash(password, 10);
    const masterReviewer = await prisma.masterReviewer.create({
      data: { masterReviewerId, name: name.trim(), email: email.trim().toLowerCase(), password: hash, plainPassword: password },
    });

    return NextResponse.json({ id: masterReviewer.id, masterReviewerId: masterReviewer.masterReviewerId, name: masterReviewer.name, email: masterReviewer.email }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Email already registered' }, { status: 409 });
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
