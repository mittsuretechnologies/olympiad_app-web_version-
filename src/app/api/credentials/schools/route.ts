import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const schools = await prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const result = schools.map((s) => ({
      id: s.id,
      schoolId: s.schoolId,
      name: s.name,
      email: s.email,
      contactPerson: s.contactPerson,
      username: s.username,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    }));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GET credentials/schools failed:', error);
    console.error('Error details:', { name: error?.name, message: error?.message, code: error?.code });
    return NextResponse.json(
      { message: 'Failed to fetch credentials', error: error?.message, code: error?.code },
      { status: 500 }
    );
  }
}
