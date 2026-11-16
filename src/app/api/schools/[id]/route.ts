import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { crmIdProblem } from '@/lib/schoolCrm';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request, 'schools.view');
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
      examDate,
    } = body;

    if (!name || !olympiadId || !state || !district) {
      return NextResponse.json(
        { message: 'School name, CRM ID, State, and District are required' },
        { status: 400 }
      );
    }

    // The CRM number is the Olympiad ID prefix — keep it valid and unique.
    const crmProblem = await crmIdProblem(olympiadId, id);
    if (crmProblem) {
      return NextResponse.json({ message: crmProblem }, { status: 400 });
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
        examDate: examDate ? new Date(examDate) : null,
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
  const { payload, error } = await requireAdmin(request, 'schools.view');
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    const { isActive } = body;
    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ message: 'isActive must be a boolean' }, { status: 400 });
    }
    // Deactivating locks the school out at once (see inactiveSchoolResponse), so
    // the reason is required and goes on the Activity Log; optional when reactivating.
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;
    if (!isActive && !reason) {
      return NextResponse.json({ message: 'Please write the reason for deactivating this school.' }, { status: 400 });
    }
    const before = await prisma.school.findUnique({ where: { id }, select: { isActive: true } });
    const updated = await prisma.school.update({
      where: { id },
      data: { isActive },
    });
    if (before?.isActive !== isActive) {
      await recordAuditLog({
        actorId: payload.id, actorRole: payload.role, actorName: payload.name || payload.email || null,
        action: isActive ? 'SCHOOL_ACTIVATED' : 'SCHOOL_DEACTIVATED',
        entityType: 'School', entityId: id,
        previousValue: { isActive: before?.isActive ?? null },
        newValue: { isActive },
        reason,
      });
    }
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
  const { error } = await requireAdmin(request, 'schools.view');
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
