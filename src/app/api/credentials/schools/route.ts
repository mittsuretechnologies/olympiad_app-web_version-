import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { decryptPassword } from '@/lib/password-crypto';
import { recordAccessLog } from '@/lib/audit-log';

export async function GET(request: Request) {
  const { error, payload } = await requireAdmin(request, 'credentials.schools');
  if (error) return error;
  try {
    const schools = await prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const result = schools.map((s) => ({
      id: s.id,
      schoolId: s.schoolId,
      olympiadId: s.olympiadId,
      name: s.name,
      email: s.email,
      contactPerson: s.contactPerson,
      username: s.username,
      plainPassword: decryptPassword(s.plainPassword),
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    }));
    await recordAccessLog(payload, {
      action: 'CREDENTIALS_VIEWED', entityType: 'School', subjectIds: schools.map((s) => s.id), request,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET credentials/schools failed:', error);
    console.error('Error details:', { name: error?.name, message: error?.message, code: error?.code });
    return NextResponse.json({ message: 'Failed to fetch credentials' }, { status: 500 });
  }
}
