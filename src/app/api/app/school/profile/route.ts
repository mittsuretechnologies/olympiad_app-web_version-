import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { STATES } from '@/lib/locations';
import { currentGeneralSchoolAcceptance, getGeneralSchoolForUser } from '@/lib/generalSchool';

export const dynamic = 'force-dynamic';

// GET   /api/app/school/profile  -> the General School's institution details
// PATCH /api/app/school/profile  -> edit name / contact person / address.
//
// Mobile and email are not editable here: they are the verified contacts the
// agreement was accepted against, and they are what forgot-password uses.
// State and district can be corrected (they drive the school's hashtags).

export async function GET(request: Request) {
  const { payload, error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  try {
    const school = await getGeneralSchoolForUser(payload.id);
    if (!school) return NextResponse.json({ message: 'Not a school account' }, { status: 403 });
    const acceptance = await currentGeneralSchoolAcceptance(school.id);
    return NextResponse.json({ school: { ...school, agreementAccepted: Boolean(acceptance) } });
  } catch (err) {
    console.error('GET app/school/profile failed:', err);
    return NextResponse.json({ message: 'Failed to load school profile' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { payload, error } = requireRole(request, ['APP_USER']);
  if (error) return error;

  try {
    const school = await getGeneralSchoolForUser(payload.id);
    if (!school) return NextResponse.json({ message: 'Not a school account' }, { status: 403 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ message: 'Invalid request' }, { status: 400 });

    const data: Record<string, string | null> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim().replace(/\s+/g, ' ');
      if (name.length < 3 || name.length > 120) {
        return NextResponse.json({ message: 'Enter the full school name (3 to 120 characters)' }, { status: 400 });
      }
      data.name = name;
    }
    for (const key of ['contactPerson', 'city', 'address'] as const) {
      if (body[key] !== undefined) {
        const v = String(body[key] ?? '').trim();
        data[key] = v ? v.slice(0, key === 'address' ? 300 : 100) : null;
      }
    }
    if (body.pincode !== undefined) {
      const v = String(body.pincode ?? '').trim();
      if (v && !/^\d{6}$/.test(v)) return NextResponse.json({ message: 'Pincode must be 6 digits' }, { status: 400 });
      data.pincode = v || null;
    }
    if (body.state !== undefined || body.district !== undefined) {
      const stateDef = STATES.find(s => s.name.toLowerCase() === String(body.state ?? school.state).trim().toLowerCase());
      if (!stateDef) return NextResponse.json({ message: 'Select your state' }, { status: 400 });
      const districtDef = stateDef.districts.find(
        d => d.name.toLowerCase() === String(body.district ?? school.district).trim().toLowerCase(),
      );
      if (!districtDef) return NextResponse.json({ message: 'Select your district' }, { status: 400 });
      data.state = stateDef.name;
      data.district = districtDef.name;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
    }

    const updated = await prisma.generalSchool.update({
      where: { id: school.id },
      data,
      select: {
        id: true, name: true, email: true, mobile: true, contactPerson: true,
        state: true, district: true, city: true, pincode: true, address: true, isActive: true,
      },
    });
    return NextResponse.json({ school: updated });
  } catch (err) {
    console.error('PATCH app/school/profile failed:', err);
    return NextResponse.json({ message: 'Failed to update school profile' }, { status: 500 });
  }
}
