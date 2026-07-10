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
