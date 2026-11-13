import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { recallAnnouncement } from '@/lib/appAnnouncements';

export const dynamic = 'force-dynamic';

// DELETE: "Delete for everyone" — removes the message from every app user's
// notification list and every school's web bell. The sent log keeps it, marked
// as deleted.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await requireAdmin(request, 'appNotifications');
  if (error) return error;
  try {
    const { id } = await params;
    const actorName = payload.name || payload.email || null;
    const problem = await recallAnnouncement(id, actorName || payload.id);
    if (problem) return NextResponse.json({ message: problem }, { status: 400 });
    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName,
      action: 'APP_NOTIFICATION_DELETED', entityType: 'AppAnnouncement', entityId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('DELETE /api/dashboard/app-notifications/[id] failed:', e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
