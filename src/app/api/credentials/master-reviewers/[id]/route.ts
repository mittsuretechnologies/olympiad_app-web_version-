import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

// Update name/email and/or toggle active/inactive — only the fields present
// in the body are changed, so a plain { isActive } toggle still works as-is.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const { isActive, name, email } = await request.json();

    const data: Record<string, any> = {};
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (name !== undefined) {
      if (!name.trim()) return NextResponse.json({ message: 'Name cannot be empty' }, { status: 400 });
      data.name = name.trim();
    }
    if (email !== undefined) {
      if (!email.trim()) return NextResponse.json({ message: 'Email cannot be empty' }, { status: 400 });
      data.email = email.trim().toLowerCase();
    }

    const updated = await prisma.masterReviewer.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, isActive: true },
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
    await prisma.masterReviewer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
