import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

const SELECT = {
  id: true, username: true, name: true, email: true, mobile: true, jobTitle: true, avatar: true, isActive: true,
} as const;

// PATCH /api/master-admins/:id — only the fields present in the body change,
// so a plain { isActive } toggle works on its own. The username is fixed
// once created (it's what they log in with). SuperAdmin only.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, any> = {};
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ message: 'Full name cannot be empty' }, { status: 400 });
      data.name = name;
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (email && !EMAIL_RE.test(email)) return NextResponse.json({ message: 'Enter a valid email address' }, { status: 400 });
      data.email = email || null;
    }
    if (body.mobile !== undefined) {
      const mobile = String(body.mobile).replace(/\D/g, '');
      if (mobile && !MOBILE_RE.test(mobile)) return NextResponse.json({ message: 'Enter a valid 10-digit mobile number' }, { status: 400 });
      data.mobile = mobile || null;
    }
    if (body.jobTitle !== undefined) data.jobTitle = String(body.jobTitle).trim() || null;
    if (body.avatar !== undefined) data.avatar = String(body.avatar).trim() || 'male';

    const before = await prisma.masterAdmin.findUnique({ where: { id }, select: SELECT });
    if (!before) return NextResponse.json({ message: 'Master Admin not found' }, { status: 404 });

    const updated = await prisma.masterAdmin.update({ where: { id }, data, select: SELECT });
    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName: payload.name || payload.email,
      action: data.isActive === undefined ? 'MASTER_ADMIN_UPDATED' : (data.isActive ? 'MASTER_ADMIN_ACTIVATED' : 'MASTER_ADMIN_DEACTIVATED'),
      entityType: 'MasterAdmin', entityId: id, previousValue: before, newValue: updated,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ message: 'This email is already used by another Master Admin' }, { status: 409 });
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// DELETE /api/master-admins/:id — removes the account (its individual
// permission override cascades). Their audit-log rows stay. SuperAdmin only.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const removed = await prisma.masterAdmin.delete({ where: { id }, select: SELECT });
    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName: payload.name || payload.email,
      action: 'MASTER_ADMIN_DELETED', entityType: 'MasterAdmin', entityId: id, previousValue: removed,
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ message: 'Master Admin not found' }, { status: 404 });
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
