import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { encryptPassword } from '@/lib/password-crypto';
import { recordAccessLog } from '@/lib/audit-log';
import { generateMasterAdminPassword } from '@/lib/masterAdminPassword';

// POST /api/master-admins/:id/reset — body: { password? }. Blank = a new
// auto-generated password. Returns the new password once. SuperAdmin only.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const { password } = await request.json().catch(() => ({}));
    const custom = typeof password === 'string' ? password.trim() : '';
    if (custom && custom.length < 8) {
      return NextResponse.json({ message: 'Password must be at least 8 characters' }, { status: 400 });
    }
    const newPassword = custom || generateMasterAdminPassword();

    await prisma.masterAdmin.update({
      where: { id },
      data: { password: await bcrypt.hash(newPassword, 10), plainPassword: encryptPassword(newPassword) },
    });
    await recordAccessLog(payload, { action: 'CREDENTIALS_RESET', entityType: 'MasterAdmin', subjectIds: [id], request });

    return NextResponse.json({ success: true, plainPassword: newPassword });
  } catch (e: any) {
    if (e.code === 'P2025') return NextResponse.json({ message: 'Master Admin not found' }, { status: 404 });
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
