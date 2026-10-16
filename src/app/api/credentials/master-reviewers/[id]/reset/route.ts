import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { encryptPassword } from '@/lib/password-crypto';
import { recordAccessLog } from '@/lib/audit-log';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, payload } = await requireAdmin(request, 'credentials.masterReviewers');
  if (error) return error;
  try {
    const { id } = await params;
    const { password } = await request.json();

    const newPassword = password?.trim() || Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.masterReviewer.update({
      where: { id },
      data: { password: hash, plainPassword: encryptPassword(newPassword) },
    });
    await recordAccessLog(payload, { action: 'CREDENTIALS_RESET', entityType: 'MasterReviewer', subjectIds: [id], request });

    return NextResponse.json({ success: true, plainPassword: newPassword });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
