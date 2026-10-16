import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { isReadOnlyKey } from '@/lib/permission-modules';

export function requireRole(request: Request, allowedRoles: string[]) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  }

  let payload: any;
  try {
    payload = jwt.verify(token, getJwtSecret());
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
// passes — same bypass the dashboard UI gives it. Passing several keys
// allows the request if any one of them is granted (for endpoints shared by
// pages that sit under different modules).
//
// MasterAdmin tokens live for a day, so deactivation is re-checked here on
// every request rather than only at login.
//
// Pass the request so read-only grants (see isReadOnlyKey) can be enforced:
// a write (anything but GET/HEAD) is refused when every granted key it
// matched is read-only.
export async function requireModule(payload: any, moduleKey: string | string[], request?: Request) {
  if (payload?.role === 'SUPERADMIN') return { ok: true as const };

  if (payload?.role === 'MASTER_ADMIN') {
    const admin = await prisma.masterAdmin.findUnique({ where: { id: payload?.id }, select: { isActive: true } });
    if (!admin?.isActive) {
      return { error: NextResponse.json({ message: 'Your account has been deactivated. Contact admin.' }, { status: 401 }) };
    }
  }

  const individual = await prisma.individualPermissions.findUnique({
    where: { memberId: payload?.id },
    select: { allowedModules: true },
  });

  const allowedModules = individual
    ? individual.allowedModules
    : (await prisma.rolePermissions.findUnique({ where: { role: payload?.role }, select: { allowedModules: true } }))
        ?.allowedModules ?? [];

  const keys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];
  const granted = keys.filter((k) => allowedModules.includes(k));
  if (granted.length === 0) {
    return { error: NextResponse.json({ message: 'Forbidden' }, { status: 403 }) };
  }
  const isWrite = request && !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  if (isWrite && granted.every((k) => isReadOnlyKey(allowedModules, k))) {
    return {
      error: NextResponse.json(
        { message: 'You have view-only access to this section — changes are not allowed. Contact the Super Admin.' },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const };
}

type AdminCheck = { payload: any; error?: undefined } | { payload?: undefined; error: NextResponse };

// For dashboard endpoints that used to be SuperAdmin-only: SuperAdmin always
// passes, a MasterAdmin passes when granted any of moduleKeys.
export async function requireAdmin(request: Request, moduleKey: string | string[]): Promise<AdminCheck> {
  const { payload, error } = requireRole(request, ['SUPERADMIN', 'MASTER_ADMIN']);
  if (error) return { error };
  const check = await requireModule(payload, moduleKey, request);
  if ('error' in check && check.error) return { error: check.error };
  return { payload };
}
