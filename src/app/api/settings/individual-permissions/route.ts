import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// POST — upsert individual permissions for a reviewer or evaluator
export async function POST(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { role, memberId, allowedModules } = await request.json();
    // memberId = reviewer.id or talentEvaluator.id
    if (!role || !memberId || !Array.isArray(allowedModules))
      return NextResponse.json({ message: 'role, memberId and allowedModules required' }, { status: 400 });

    const data: any = { allowedModules };
    if (role === 'REVIEWER') {
      data.reviewerId = memberId;
      data.evaluatorId = null;
    } else {
      data.evaluatorId = memberId;
      data.reviewerId = null;
    }

    const perm = await prisma.individualPermissions.upsert({
      where: { memberId },
      update: { allowedModules },
      create: { memberId, role, allowedModules, ...data },
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
