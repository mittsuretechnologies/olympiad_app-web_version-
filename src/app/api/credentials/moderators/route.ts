import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

function generateModeratorId(): string {
  return `MOD${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const moderators = await prisma.moderator.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, moderatorId: true, name: true, email: true, isActive: true, plainPassword: true, createdAt: true },
    });
    return NextResponse.json(moderators);
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

    let moderatorId = generateModeratorId();
    let attempt = 0;
    while (await prisma.moderator.findUnique({ where: { moderatorId } })) {
      moderatorId = generateModeratorId();
      if (++attempt > 20) throw new Error('Could not generate unique moderator ID');
    }

    const hash = await bcrypt.hash(password, 10);
    const moderator = await prisma.moderator.create({
      data: {
        moderatorId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hash,
        plainPassword: password,
      },
    });

    return NextResponse.json({
      id: moderator.id, moderatorId: moderator.moderatorId, name: moderator.name, email: moderator.email,
    }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Email already registered' }, { status: 409 });
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
