import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export function requireRole(request: Request, allowedRoles: string[]) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  let payload: any;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
  } catch {
    return { error: NextResponse.json({ message: 'Invalid token' }, { status: 401 }) };
  }

  if (!allowedRoles.includes(payload?.role) || !payload?.id) {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
  }

  return { payload };
}

// Module-level check on top of requireRole, mirroring the sidebar's own
// canSee()/canSeeSubItem() logic in src/app/dashboard/layout.tsx: an
// IndividualPermissions override (looked up by memberId = payload.id) takes
// precedence over the role's RolePermissions default. SuperAdmin always
// passes — same bypass the dashboard UI gives it.
export async function requireModule(payload: any, moduleKey: string) {
  if (payload?.role === 'SUPERADMIN') return { ok: true as const };

  const individual = await prisma.individualPermissions.findUnique({
    where: { memberId: payload?.id },
    select: { allowedModules: true },
  });

  const allowedModules = individual
    ? individual.allowedModules
    : (await prisma.rolePermissions.findUnique({ where: { role: payload?.role }, select: { allowedModules: true } }))
        ?.allowedModules ?? [];

  if (!allowedModules.includes(moduleKey)) {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true as const };
}
