import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

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

function generateUsername(schoolName: string, schoolId: string): string {
  const nameClean = schoolName.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const available = Math.max(0, 10 - schoolId.length);
  const prefix = nameClean.slice(0, available);
  return (prefix + schoolId).slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const { schools } = await request.json();

    if (!Array.isArray(schools) || schools.length === 0) {
      return NextResponse.json({ message: 'No school data provided' }, { status: 400 });
    }

    const validSchools = schools.filter((s) => s.name && s.olympiadId && s.state && s.district);

    const created: Array<{ schoolId: string; name: string; username: string; password: string }> = [];
    const errors: Array<{ name: string; reason: string }> = [];

    for (const school of validSchools) {
      let attempts = 0;
      while (attempts < 3) {
        const schoolId = await generateSchoolId();
        const plainPassword = generatePassword(10);
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        try {
          await prisma.school.create({
            data: {
              schoolId,
              olympiadId: school.olympiadId,
              name: school.name,
              address: school.address || null,
              email: school.email || null,
              phone: school.phone || null,
              contactPerson: school.contactPerson || null,
              city: school.city || null,
              district: school.district || null,
              state: school.state || null,
              pincode: school.pincode || null,
              username: generateUsername(school.name, schoolId),
              password: hashedPassword,
            },
          });
          const username = generateUsername(school.name, schoolId);
          created.push({ schoolId, name: school.name, username, password: plainPassword });
          break;
        } catch (err: any) {
          if (err?.code === 'P2002' && attempts < 2) {
            attempts++;
            continue;
          }
          errors.push({ name: school.name, reason: err?.message || 'Unknown error' });
          break;
        }
      }
    }

    return NextResponse.json({
      message: `Created ${created.length} school(s)${errors.length ? `, ${errors.length} failed` : ''}`,
      created,
      errors,
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({ message: 'Failed to bulk upload schools' }, { status: 500 });
  }
}
