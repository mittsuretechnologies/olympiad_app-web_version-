import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { toDeltaOverride } from '@/lib/permission-modules';

// POST — upsert individual permissions for a reviewer, evaluator, moderator or master admin.
// allowedModules is the full list the member should end up with; it is stored
// as the difference from the role's global list, so every module the Super
// Admin left as it is keeps following global (see resolveAllowedModules).
export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { role, memberId, allowedModules: effective } = await request.json();
    // memberId = reviewer.id / talentEvaluator.id / moderator.id / masterAdmin.id
    if (!role || !memberId || !Array.isArray(effective))
      return NextResponse.json({ message: 'role, memberId and allowedModules required' }, { status: 400 });

    const global = (await prisma.rolePermissions.findUnique({ where: { role }, select: { allowedModules: true } }))?.allowedModules ?? [];
    const allowedModules = toDeltaOverride(global, effective);

    const data: any = { allowedModules, reviewerId: null, evaluatorId: null, moderatorId: null, masterAdminId: null };
    if (role === 'REVIEWER') data.reviewerId = memberId;
    else if (role === 'EVALUATOR') data.evaluatorId = memberId;
    else if (role === 'MASTER_ADMIN') data.masterAdminId = memberId;
    else data.moderatorId = memberId;

    const perm = await prisma.individualPermissions.upsert({
      where: { memberId },
      update: { allowedModules },
      create: { memberId, role, ...data },
    });
    return NextResponse.json(perm);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// DELETE — remove individual override
export async function DELETE(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { memberId } = await request.json();
    await prisma.individualPermissions.delete({ where: { memberId } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
