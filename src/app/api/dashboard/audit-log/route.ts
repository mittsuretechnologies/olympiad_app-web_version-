import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/audit-log — superadmin-only view of every logged
// moderation/evaluation action (who did what, to what, and when).
// Query params: action, actorRole, entityType, entityId, from, to, page, pageSize
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const action     = searchParams.get('action') || undefined;
    const actorRole  = searchParams.get('actorRole') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const entityId   = searchParams.get('entityId') || undefined;
    const from       = searchParams.get('from') || undefined;
    const to         = searchParams.get('to') || undefined;
    const page       = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize   = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));

    const where: Record<string, any> = {};
    if (action) where.action = action;
    if (actorRole) where.actorRole = actorRole;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error('GET dashboard/audit-log failed:', error);
    return NextResponse.json({ message: 'Failed to fetch audit log' }, { status: 500 });
  }
}
