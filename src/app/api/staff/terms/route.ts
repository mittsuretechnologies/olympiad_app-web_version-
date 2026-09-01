import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// Terms & Conditions gate for Moderator / Evaluator dashboard access.
// GET  -> whether the logged-in staff member still needs to accept.
// POST -> record acceptance (name/email captured server-side from the JWT,
//         not the client, so it can't be spoofed).

const GATED_ROLES = ['MODERATOR', 'EVALUATOR'];

async function loadRecord(role: string, id: string) {
  if (role === 'MODERATOR') {
    return prisma.moderator.findUnique({ where: { id }, select: { termsAccepted: true, termsAcceptedAt: true } });
  }
  return prisma.talentEvaluator.findUnique({ where: { id }, select: { termsAccepted: true, termsAcceptedAt: true } });
}

export async function GET(request: Request) {
  const { payload, error } = requireRole(request, GATED_ROLES);
  if (error) return error;

  const record = await loadRecord(payload.role, payload.id);
  if (!record) return NextResponse.json({ message: 'Account not found' }, { status: 404 });

  return NextResponse.json({
    termsAccepted: record.termsAccepted,
    termsAcceptedAt: record.termsAcceptedAt,
  });
}

export async function POST(request: Request) {
  const { payload, error } = requireRole(request, GATED_ROLES);
  if (error) return error;

  const now = new Date();
  if (payload.role === 'MODERATOR') {
    await prisma.moderator.update({
      where: { id: payload.id },
      data: { termsAccepted: true, termsAcceptedAt: now },
    });
  } else {
    await prisma.talentEvaluator.update({
      where: { id: payload.id },
      data: { termsAccepted: true, termsAcceptedAt: now },
    });
  }

  return NextResponse.json({ termsAccepted: true, termsAcceptedAt: now });
}
