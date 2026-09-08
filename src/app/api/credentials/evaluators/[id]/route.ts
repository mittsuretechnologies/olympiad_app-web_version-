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
    if ('name' in body) {
      if (!String(body.name).trim()) return NextResponse.json({ message: 'Name cannot be empty' }, { status: 400 });
      data.name = String(body.name).trim();
    }
    if ('email' in body) {
      if (!String(body.email).trim()) return NextResponse.json({ message: 'Email cannot be empty' }, { status: 400 });
      data.email = String(body.email).trim().toLowerCase();
    }

    const updated = await prisma.talentEvaluator.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, isActive: true, assignedStates: true, assignedDistricts: true },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'Email already registered' }, { status: 409 });
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
