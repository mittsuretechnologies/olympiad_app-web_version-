import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// GET — returns global role perms + individual perms
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN', 'REVIEWER', 'EVALUATOR']);
  if (error) return error;
  try {
    const [global, individual] = await Promise.all([
      prisma.rolePermissions.findMany(),
      prisma.individualPermissions.findMany({
        include: { reviewer: { select: { id: true, name: true, reviewerId: true } }, evaluator: { select: { id: true, name: true, evaluatorId: true } } },
      }),
    ]);
    return NextResponse.json({ global, individual });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// POST — upsert global role permissions
export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { role, allowedModules } = await request.json();
    if (!role || !Array.isArray(allowedModules))
      return NextResponse.json({ message: 'role and allowedModules required' }, { status: 400 });

    const perm = await prisma.rolePermissions.upsert({
      where: { role },
      update: { allowedModules },
      create: { role, allowedModules },
    });
    return NextResponse.json(perm);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
