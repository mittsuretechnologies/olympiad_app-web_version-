import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { isSuspended } from '@/lib/accountSuspension';

export const dynamic = 'force-dynamic';

// PATCH /api/dashboard/app-users/:id - Super Admin only.
//   { action: 'suspend', days: 1-365, reason? }  timed suspension, lifts itself
//   { action: 'ban', reason? }                   permanent until reinstated
//   { action: 'reinstate' }                      clears any suspension / ban
// The user is logged out on the next /app/me, cannot log in, and their videos
// disappear from every feed while it is in force (see lib/accountSuspension.ts).

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (!['suspend', 'ban', 'reinstate'].includes(action)) {
      return NextResponse.json({ message: "action must be 'suspend', 'ban' or 'reinstate'" }, { status: 400 });
    }
    const reason = typeof body.reason === 'string'
      ? body.reason.trim().replace(/\s+/g, ' ').slice(0, 500) || null
      : null;

    const user = await prisma.appUser.findUnique({
      where: { id },
      select: { id: true, userId: true, suspendedAt: true, suspendedUntil: true, suspensionType: true, suspensionReason: true },
    });
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    let data: { suspendedAt: Date | null; suspendedUntil: Date | null; suspensionType: string | null; suspensionReason: string | null };
    if (action === 'reinstate') {
      if (!user.suspendedAt) return NextResponse.json({ message: 'Account is not suspended' }, { status: 400 });
      data = { suspendedAt: null, suspendedUntil: null, suspensionType: null, suspensionReason: null };
    } else if (action === 'ban') {
      data = { suspendedAt: new Date(), suspendedUntil: null, suspensionType: 'BAN', suspensionReason: reason };
    } else {
      const days = Number(body.days);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        return NextResponse.json({ message: 'days must be a whole number from 1 to 365' }, { status: 400 });
      }
      data = {
        suspendedAt: new Date(),
        suspendedUntil: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        suspensionType: 'SUSPEND',
        suspensionReason: reason,
      };
    }

    await prisma.appUser.update({ where: { id }, data });

    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName: payload.name || payload.email || null,
      action: action === 'ban' ? 'APP_USER_BANNED' : action === 'suspend' ? 'APP_USER_SUSPENDED' : 'APP_USER_REINSTATED',
      entityType: 'AppUser', entityId: user.id,
      previousValue: { suspended: isSuspended(user), suspendedUntil: user.suspendedUntil, userId: user.userId },
      newValue: { suspendedUntil: data.suspendedUntil, suspensionType: data.suspensionType, userId: user.userId },
      reason,
    });

    return NextResponse.json({
      id: user.id,
      suspendedAt: data.suspendedAt,
      suspendedUntil: data.suspendedUntil,
      suspensionType: data.suspensionType,
      suspensionReason: data.suspensionReason,
    });
  } catch (err) {
    console.error('PATCH dashboard/app-users/[id] failed:', err);
    return NextResponse.json({ message: 'Failed to update account' }, { status: 500 });
  }
}
