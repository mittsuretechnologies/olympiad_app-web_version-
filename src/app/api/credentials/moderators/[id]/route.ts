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
    // Re-arm the T&C gate: superadmin can force a moderator to re-accept on
    // their next login by clearing termsAccepted (see /api/staff/terms).
    if ('termsAccepted' in body) {
      data.termsAccepted = Boolean(body.termsAccepted);
      data.termsAcceptedAt = data.termsAccepted ? new Date() : null;
    }

    const updated = await prisma.moderator.update({
      where: { id },
      data,
      select: { id: true, isActive: true, termsAccepted: true, termsAcceptedAt: true },
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
    await prisma.moderator.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
