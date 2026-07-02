import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

function generateEvaluatorId(): string {
  return `EVL${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const evaluators = await prisma.talentEvaluator.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, evaluatorId: true, name: true, email: true, isActive: true, plainPassword: true, createdAt: true },
    });
    return NextResponse.json(evaluators);
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

    let evaluatorId = generateEvaluatorId();
    let attempt = 0;
    while (await prisma.talentEvaluator.findUnique({ where: { evaluatorId } })) {
      evaluatorId = generateEvaluatorId();
      if (++attempt > 20) throw new Error('Could not generate unique evaluator ID');
    }

    const hash = await bcrypt.hash(password, 10);
    const evaluator = await prisma.talentEvaluator.create({
      data: { evaluatorId, name: name.trim(), email: email.trim().toLowerCase(), password: hash, plainPassword: password },
    });

    return NextResponse.json({ id: evaluator.id, evaluatorId: evaluator.evaluatorId, name: evaluator.name, email: evaluator.email }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Email already registered' }, { status: 409 });
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
