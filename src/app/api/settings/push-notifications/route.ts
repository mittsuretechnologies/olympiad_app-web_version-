import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { broadcastUserWhere, isPushConfigured, sendPushBroadcast, type BroadcastAudience } from '@/lib/push';

export const dynamic = 'force-dynamic';
// A broadcast to every phone can take a little while.
export const maxDuration = 120;

const AUDIENCES: BroadcastAudience[] = ['ALL', 'STUDENTS', 'GENERAL'];

// GET /api/settings/push-notifications — SuperAdmin only. Whether Firebase is
// set up, and how many accounts / phones each audience reaches.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  const counts = await Promise.all(AUDIENCES.map(async (a) => {
    const where = broadcastUserWhere(a);
    const [users, devices] = await Promise.all([
      prisma.appUser.count({ where }),
      prisma.pushToken.count({ where: { appUser: where } }),
    ]);
    return [a, { users, devices }] as const;
  }));

  return NextResponse.json({ configured: isPushConfigured(), counts: Object.fromEntries(counts) });
}

// POST /api/settings/push-notifications { title, message, audience }
// Sends an announcement: a row in every recipient's in-app notification list,
// and a push to every phone they're logged in on.
export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const body = await request.json();
    const title = String(body.title ?? '').trim().slice(0, 80);
    const message = String(body.message ?? '').trim().slice(0, 300);
    const audience: BroadcastAudience = AUDIENCES.includes(body.audience) ? body.audience : 'ALL';
    if (!title || !message) {
      return NextResponse.json({ message: 'Title and message are both required' }, { status: 400 });
    }

    // In-app copy, so it is still in the bell list after the push is dismissed.
    const users = await prisma.appUser.findMany({ where: broadcastUserWhere(audience), select: { id: true } });
    const CHUNK = 5000;
    for (let i = 0; i < users.length; i += CHUNK) {
      await prisma.notification.createMany({
        data: users.slice(i, i + CHUNK).map(u => ({ userId: u.id, type: 'ANNOUNCEMENT', title, message })),
      });
    }

    const delivered = await sendPushBroadcast(audience, { title, body: message, data: { type: 'ANNOUNCEMENT' } });

    await recordAuditLog({
      actorId: payload!.id,
      actorRole: payload!.role,
      actorName: payload!.name || payload!.email || null,
      action: 'PUSH_BROADCAST_SENT',
      entityType: 'Notification',
      entityId: 'broadcast',
      newValue: { title, message, audience, users: users.length, delivered },
    });

    return NextResponse.json({ users: users.length, delivered });
  } catch (e: any) {
    console.error('push broadcast error:', e);
    return NextResponse.json({ message: e.message || 'Could not send' }, { status: 500 });
  }
}
