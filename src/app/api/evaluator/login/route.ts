import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { evaluatorId, password } = await request.json();
    if (!evaluatorId || !password)
      return NextResponse.json({ message: 'Evaluator ID and password required' }, { status: 400 });

    const evaluator = await prisma.talentEvaluator.findUnique({
      where: { evaluatorId: evaluatorId.trim().toUpperCase() },
    });
    if (!evaluator)
      return NextResponse.json({ message: 'Invalid Evaluator ID or password' }, { status: 401 });
    if (!evaluator.isActive)
      return NextResponse.json({ message: 'Your account has been deactivated. Contact admin.' }, { status: 403 });

    const match = await bcrypt.compare(password, evaluator.password);
    if (!match)
      return NextResponse.json({ message: 'Invalid Evaluator ID or password' }, { status: 401 });

    const token = jwt.sign(
      { id: evaluator.id, evaluatorId: evaluator.evaluatorId, role: 'EVALUATOR' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      token,
      evaluator: { id: evaluator.id, evaluatorId: evaluator.evaluatorId, name: evaluator.name, email: evaluator.email },
    });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
