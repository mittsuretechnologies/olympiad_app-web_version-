import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { hardDeleteAppUser } from '@/lib/accountDeletion';

// PATCH /api/dashboard/account-deletion-requests/:id — body: { action: 'approve' | 'reject' }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { payload, error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  const { id } = await params;

  try {
    const { action } = await request.json();
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ message: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    const reqRow = await prisma.accountDeletionRequest.findUnique({
      where:  { id },
      select: { id: true, appUserId: true, status: true, appUser: { select: { userId: true } } },
    });
    if (!reqRow) return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    if (reqRow.status !== 'PENDING') {
      return NextResponse.json({ message: 'This request has already been decided' }, { status: 409 });
    }

    if (action === 'reject') {
      await prisma.accountDeletionRequest.update({
        where: { id }, data: { status: 'REJECTED', decidedAt: new Date() },
      });
      await recordAuditLog({
        actorId: payload.id, actorRole: payload.role, actorName: payload.email || null,
        action: 'ACCOUNT_DELETION_REJECTED', entityType: 'AccountDeletionRequest', entityId: id,
        newValue: { status: 'REJECTED', appUserId: reqRow.appUserId, userId: reqRow.appUser.userId },
      });
      return NextResponse.json({ success: true, status: 'REJECTED' });
    }

    // Approve — true permanent wipe. Record the audit entry first since the
    // AppUser row (and this request row, via cascade) won't exist afterward.
    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName: payload.email || null,
      action: 'ACCOUNT_DELETED', entityType: 'AppUser', entityId: reqRow.appUserId,
      newValue: { userId: reqRow.appUser.userId },
      reason: 'Approved account deletion request',
    });
    await hardDeleteAppUser(reqRow.appUserId);

    return NextResponse.json({ success: true, status: 'APPROVED' });
  } catch (error) {
    console.error('PATCH /api/dashboard/account-deletion-requests/[id] failed:', error);
    return NextResponse.json({ message: 'Failed to update request' }, { status: 500 });
  }
}
