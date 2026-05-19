import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const schools = await prisma.school.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(schools);
  } catch (error) {
    return NextResponse.json({ message: 'Failed to fetch schools' }, { status: 500 });
  }
}

async function generateSchoolId(): Promise<string> {
  const last = await prisma.school.findFirst({
    where: { schoolId: { startsWith: 'MITT' } },
    orderBy: { schoolId: 'desc' },
    select: { schoolId: true },
  });

  const lastNum = last ? parseInt(last.schoolId.replace('MITT', ''), 10) : 0;
  const nextNum = (isNaN(lastNum) ? 0 : lastNum) + 1;
  return `MITT${String(nextNum).padStart(3, '0')}`;
}

function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      olympiadId,
      address,
      email,
      phone,
      contactPerson,
      city,
      state,
      pincode,
    } = body;

    if (!name || !olympiadId) {
      return NextResponse.json(
        { message: 'School name and CRM ID are required' },
        { status: 400 }
      );
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const schoolId = await generateSchoolId();
      const plainPassword = generatePassword(10);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      try {
        const school = await prisma.school.create({
          data: {
            schoolId,
            olympiadId,
            name,
            address,
            email,
            phone,
            contactPerson,
            city,
            state,
            pincode,
            username: schoolId,
            password: hashedPassword,
          },
        });

        return NextResponse.json({
          ...school,
          credentials: {
            username: schoolId,
            password: plainPassword,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 2) continue;
        throw err;
      }
    }

    return NextResponse.json({ message: 'Could not allocate schoolId' }, { status: 500 });
  } catch (error) {
    console.error('POST /api/schools failed:', error);
    return NextResponse.json({ message: 'Failed to create school' }, { status: 500 });
  }
}
