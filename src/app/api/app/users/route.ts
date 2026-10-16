import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { decryptPassword } from '@/lib/password-crypto';
import { recordAccessLog } from '@/lib/audit-log';

export async function GET(request: Request) {
  const { error, payload } = await requireAdmin(request, 'reports.appusers');
  if (error) return error;
  try {
    const users = await prisma.appUser.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        email: true,
        mobile: true,
        olympiadId: true,
        isVerified: true,
        termsAccepted: true,
        accountType: true,
        plainPassword: true,
        createdAt: true,
      },
    });
    await recordAccessLog(payload, {
      action: 'CREDENTIALS_VIEWED', entityType: 'AppUser', subjectIds: users.map((u) => u.id), request,
    });
    return NextResponse.json(
      users.map((u) => ({ ...u, plainPassword: decryptPassword(u.plainPassword) }))
    );
  } catch (error) {
    console.error('app-users GET error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
