import { prisma } from '@/lib/prisma';

interface AuditLogEntry {
  actorId: string;
  actorRole: string;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}

// Access to personal data or credentials (who saw what, when). One row per request:
//   USER_DETAILS_VIEWED — personal details (names, phones, emails, …) shown to staff
//   CREDENTIALS_VIEWED  — decrypted passwords shown to staff
//   CREDENTIALS_SENT    — a password emailed / texted to its owner by staff
//   CREDENTIALS_RESET   — a password reset by staff (the new one is shown to them)
export type AccessAction = 'USER_DETAILS_VIEWED' | 'CREDENTIALS_VIEWED' | 'CREDENTIALS_SENT' | 'CREDENTIALS_RESET';

const MAX_LOGGED_SUBJECTS = 200;

export async function recordAccessLog(
  actor: { id: string; role: string; name?: string | null; email?: string | null },
  entry: {
    action: AccessAction;
    entityType: string;          // whose data: AppUser, Student, School, Moderator, …
    subjectIds: string[];        // the records returned / acted on
    request: Request;
    details?: Record<string, unknown>;
  },
) {
  const url = new URL(entry.request.url);
  const ids = [...new Set(entry.subjectIds.filter(Boolean))];
  await recordAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    actorName: actor.name || actor.email || null,
    action: entry.action,
    entityType: entry.entityType,
    // A single record is the entity itself; a list view is logged as LIST with the ids below.
    entityId: ids.length === 1 ? ids[0] : 'LIST',
    newValue: {
      endpoint: `${entry.request.method} ${url.pathname}${url.search}`,
      count: ids.length,
      subjectIds: ids.slice(0, MAX_LOGGED_SUBJECTS),
      ...(ids.length > MAX_LOGGED_SUBJECTS ? { truncated: true } : {}),
      ...entry.details,
    },
  });
}

// Fire-and-forget-safe: awaited by callers, but a logging failure never
// throws past this function so it can't take down the action it's recording.
export async function recordAuditLog(entry: AuditLogEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        actorName: entry.actorName ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        previousValue: entry.previousValue !== undefined ? JSON.stringify(entry.previousValue) : null,
        newValue: entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
        reason: entry.reason ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error, entry);
  }
}
