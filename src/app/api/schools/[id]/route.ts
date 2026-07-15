import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      olympiadId,
      address,
      email,
      phone,
      contactPerson,
      city,
      district,
      districtCode,
      state,
      stateCode,
      pincode,
    } = body;

    if (!name || !olympiadId || !state || !district) {
      return NextResponse.json(
        { message: 'School name, CRM ID, State, and District are required' },
        { status: 400 }
      );
    }

    const updated = await prisma.school.update({
      where: { id },
      data: {
        name,
        olympiadId,
        address,
        email,
        phone,
        contactPerson,
        city,
        district,
        districtCode,
        state,
        stateCode,
        pincode,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/schools/[id] failed:', error);
    if (error?.code === 'P2025') {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to update school' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    const { isActive } = body;
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ message: 'isActive must be a boolean' }, { status: 400 });
    }
    const updated = await prisma.school.update({
      where: { id },
      data: { isActive },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/schools/[id] failed:', error);
    if (error?.code === 'P2025') {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to update school status' }, { status: 500 });
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
    await prisma.school.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/schools/[id] failed:', error);
    if (error?.code === 'P2025') {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to delete school' }, { status: 500 });
  }
}
