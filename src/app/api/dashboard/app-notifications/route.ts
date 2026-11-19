import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import {
  ANNOUNCEMENT_LIMITS, announcementHistory, cleanFilters, linkProblem, placeOptions, sendAnnouncement,
} from '@/lib/appAnnouncements';

export const dynamic = 'force-dynamic';

// SuperAdmin → App Notifications.
//
// GET: the sent history (with read counts) and the states / districts the
// filters can choose from.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'appNotifications');
  if (error) return error;
  try {
    const [history, places] = await Promise.all([announcementHistory(), placeOptions()]);
    return NextResponse.json({ history, places });
  } catch (e: any) {
    console.error('GET /api/dashboard/app-notifications failed:', e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// POST { title, message, link?, filters: { types, states, districts, classes } }
// Puts the message in the app notification list of everyone the filters reach
// (and in the web School Panel bell of Olympiad schools).
export async function POST(request: Request) {
  const { payload, error } = await requireAdmin(request, 'appNotifications');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const link = typeof body?.link === 'string' ? body.link.trim() : '';
    if (!title || !message) return NextResponse.json({ message: 'Title and message are required.' }, { status: 400 });
    if (title.length > ANNOUNCEMENT_LIMITS.title) {
      return NextResponse.json({ message: `The title can be at most ${ANNOUNCEMENT_LIMITS.title} characters.` }, { status: 400 });
    }
    if (message.length > ANNOUNCEMENT_LIMITS.message) {
      return NextResponse.json({ message: `The message can be at most ${ANNOUNCEMENT_LIMITS.message} characters.` }, { status: 400 });
    }
    const badLink = linkProblem(link);
    if (badLink) return NextResponse.json({ message: badLink }, { status: 400 });
    const filters = cleanFilters(body?.filters);
    if (typeof filters === 'string') return NextResponse.json({ message: filters }, { status: 400 });

    const senderName = payload.name || payload.email || null;
    const result = await sendAnnouncement({
      title, message, link: link || null, filters, sender: { id: payload.id, name: senderName },
    });
    if (typeof result === 'string') return NextResponse.json({ message: result }, { status: 400 });

    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName: senderName,
      action: 'APP_NOTIFICATION_SENT', entityType: 'AppAnnouncement', entityId: result.id,
      newValue: { title, link: link || null, filters, appRecipients: result.appRecipients, webRecipients: result.webRecipients },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/dashboard/app-notifications failed:', e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
