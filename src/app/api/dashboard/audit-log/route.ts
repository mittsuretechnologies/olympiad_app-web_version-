import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { resolveSubject, enrichLogs } from '@/lib/audit-lookup';
import {
  AUDIT_CATEGORIES, AUDIT_MAX_RANGE_DAYS, AUDIT_PAGE_SIZE, actionsInCategory,
  type AuditCategory, type AuditLookupMode,
} from '@/lib/audit-actions';

export const dynamic = 'force-dynamic';

const MODES: AuditLookupMode[] = ['staff', 'student', 'school', 'video', 'action'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// GET /api/dashboard/audit-log — one subject's history (a staff member, a
// student, a school, a video or one activity type) over a date range.
// Nothing is returned without a subject and a range, so the page never pulls
// the whole log.
//
// Query: mode, ref, from=YYYY-MM-DD, to=YYYY-MM-DD (IST days, inclusive),
//        category? (narrows to one AUDIT_CATEGORIES key), cursor? (next page),
//        export=1 (skip media signing — used by the CSV download)
// The first page (no cursor) also carries the subject card, the total and a
// per-action breakdown for the whole range.
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'activityLog');
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') as AuditLookupMode | null;
    const ref = (searchParams.get('ref') || '').trim();
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const category = searchParams.get('category') as AuditCategory | null;
    const cursor = searchParams.get('cursor') || undefined;
    const forExport = searchParams.get('export') === '1';

    if (!mode || !MODES.includes(mode) || !ref) {
      return NextResponse.json({ message: 'Choose what to look up first.' }, { status: 400 });
    }
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json({ message: 'A From and To date are required.' }, { status: 400 });
    }
    // Days are India days, whatever the server's own timezone is.
    const fromDate = new Date(`${from}T00:00:00+05:30`);
    const toDate = new Date(`${to}T23:59:59.999+05:30`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      return NextResponse.json({ message: 'The From date must be on or before the To date.' }, { status: 400 });
    }
    if ((toDate.getTime() - fromDate.getTime()) / DAY_MS > AUDIT_MAX_RANGE_DAYS) {
      return NextResponse.json({ message: `One report can cover at most ${AUDIT_MAX_RANGE_DAYS} days.` }, { status: 400 });
    }
    if (category && !AUDIT_CATEGORIES.some((c) => c.key === category)) {
      return NextResponse.json({ message: 'Unknown activity category.' }, { status: 400 });
    }

    const resolved = await resolveSubject(mode, ref);
    if (!resolved) {
      return NextResponse.json({ message: 'Nothing found for that — check the details and try again.' }, { status: 404 });
    }

    const scope: Prisma.AuditLogWhereInput = {
      AND: [resolved.where, { createdAt: { gte: fromDate, lte: toDate } }],
    };
    const where: Prisma.AuditLogWhereInput = category
      ? { AND: [scope, { action: { in: actionsInCategory(category) } }] }
      : scope;

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: AUDIT_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > AUDIT_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, AUDIT_PAGE_SIZE) : rows;
    const logs = await enrichLogs(page, { signMedia: !forExport });
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    if (cursor) return NextResponse.json({ logs, nextCursor });

    const [total, grouped] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({ by: ['action'], where: scope, _count: { _all: true } }),
    ]);
    const breakdown = Object.fromEntries(grouped.map((g) => [g.action, g._count._all]));

    return NextResponse.json({ subject: resolved.subject, total, breakdown, logs, nextCursor });
  } catch (error) {
    console.error('GET dashboard/audit-log failed:', error);
    return NextResponse.json({ message: 'Failed to fetch the activity report' }, { status: 500 });
  }
}
