import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { recordAccessLog, recordAuditLog } from '@/lib/audit-log';
import { withdrawConsent } from '@/lib/consent';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/consent-records/:appUserId — an app user's consent history, newest first.
export async function GET(request: Request, { params }: { params: Promise<{ appUserId: string }> }) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  const { appUserId } = await params;
  const records = await prisma.consentRecord.findMany({
    where: { appUserId },
    orderBy: [{ consentedAt: 'desc' }, { documentKey: 'asc' }],
  });
  await recordAccessLog(payload, { action: 'USER_DETAILS_VIEWED', entityType: 'AppUser', subjectIds: [appUserId], request });
  return NextResponse.json({ records });
}

// POST /api/dashboard/consent-records/:appUserId — body: { reason }
// Records a withdrawal of consent received by the grievance officer (Privacy
// Policy 11.3). Stamps the open records only: deactivating the account and
// erasing data follow the Account Deletion Policy and are separate steps.
export async function POST(request: Request, { params }: { params: Promise<{ appUserId: string }> }) {
  const { payload, error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { appUserId } = await params;
    const { reason } = await request.json().catch(() => ({}));
    const why = typeof reason === 'string' ? reason.trim().slice(0, 1000) : '';
    if (!why) return NextResponse.json({ message: 'Give a reason — e.g. "Parent emailed grievance on 13 Oct".' }, { status: 400 });

    const actorName = payload.name || payload.email || null;
    const count = await withdrawConsent(appUserId, { id: payload.id, name: actorName }, why);
    if (count === 0) return NextResponse.json({ message: 'No active consent records for this user.' }, { status: 404 });

    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName,
      action: 'CONSENT_WITHDRAWN', entityType: 'AppUser', entityId: appUserId,
      newValue: { withdrawnRecords: count }, reason: why,
    });
    return NextResponse.json({ success: true, withdrawnRecords: count });
  } catch (err: any) {
    console.error('POST dashboard/consent-records/:appUserId failed:', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
