import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, any> = {};
    if ('isActive' in body) data.isActive = Boolean(body.isActive);
    if ('assignedStates' in body) data.assignedStates = Array.isArray(body.assignedStates) ? body.assignedStates.filter(Boolean) : [];
    if ('assignedDistricts' in body) data.assignedDistricts = Array.isArray(body.assignedDistricts) ? body.assignedDistricts.filter(Boolean) : [];

    const updated = await prisma.talentEvaluator.update({
      where: { id },
      data,
      select: { id: true, isActive: true, assignedStates: true, assignedDistricts: true },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    await prisma.talentEvaluator.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.code === 'P2003') {
      return NextResponse.json(
        { message: 'This evaluator has submitted evaluations and cannot be deleted. Deactivate them instead.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
