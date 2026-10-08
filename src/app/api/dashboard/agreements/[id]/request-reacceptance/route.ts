import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

// POST /api/dashboard/agreements/:id/request-reacceptance
// SuperAdmin asks a school to accept the agreement again. The current
// acceptance is marked revoked (never deleted — it stays as evidence), so the
// School Panel shows the agreement gate on the school's next visit and records
// a fresh acceptance. Body: { reason?: string }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim().replace(/\s+/g, ' ').slice(0, 500) || null : null;

    const record = await prisma.agreementAcceptance.findUnique({
      where: { id },
      select: { id: true, role: true, actorId: true, actorCode: true, actorName: true, revokedAt: true, acceptedAt: true, documentVersion: true },
    });
    if (!record) return NextResponse.json({ message: 'Acceptance record not found.' }, { status: 404 });
    if (record.revokedAt) {
      return NextResponse.json({ message: 'Re-acceptance has already been requested for this record.' }, { status: 409 });
    }

    const revokedAt = new Date();
    await prisma.agreementAcceptance.update({
      where: { id },
      data: { revokedAt, revokedBy: payload.id, revokeReason: reason },
    });
    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName: payload.name || payload.email || null,
      action: 'AGREEMENT_REACCEPTANCE_REQUESTED', entityType: 'AgreementAcceptance', entityId: id,
      previousValue: { acceptedAt: record.acceptedAt, documentVersion: record.documentVersion },
      newValue: { revokedAt, role: record.role, actor: record.actorCode ?? record.actorId, actorName: record.actorName },
      reason,
    });

    return NextResponse.json({ revokedAt });
  } catch (err) {
    console.error('POST dashboard/agreements/[id]/request-reacceptance failed:', err);
    return NextResponse.json({ message: 'Could not request re-acceptance.' }, { status: 500 });
  }
}
