import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { invalidateCoinCache } from './memo';

// Shared plumbing for /api/dashboard/coins/*: SuperAdmin, or a MasterAdmin
// granted the "coins" module (view-only grants are refused on writes by
// requireModule), plus an audit-log entry for every change.

export async function coinsAdmin(request: Request) {
  return requireAdmin(request, 'coins');
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export function zodMessage(e: ZodError) {
  const i = e.issues[0];
  return i ? `${i.path.join('.') || 'value'}: ${i.message}` : 'Invalid input';
}

export function serverError(e: unknown) {
  console.error('[coins admin]', e);
  return NextResponse.json({ message: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
}

type Actor = { id: string; role: string; name?: string | null; email?: string | null };

// Records the change and clears the app-facing caches so it takes effect now.
export async function auditCoins(
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  detail?: { previous?: unknown; next?: unknown; reason?: string | null },
) {
  invalidateCoinCache();
  await recordAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    actorName: actor.name || actor.email || null,
    action,
    entityType,
    entityId,
    previousValue: detail?.previous,
    newValue: detail?.next,
    reason: detail?.reason ?? null,
  });
}
