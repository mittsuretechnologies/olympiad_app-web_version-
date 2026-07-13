import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { CLASS_CODE_BY_NAME } from '@/lib/classes';
import { sendSchoolCredentialsEmail } from '@/lib/mailer';

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

// Max 10 chars: abbreviation of school name (uppercase consonants/letters) + schoolId digits
// e.g. "Sunrise Public School" + "MITT001" → "SUN" + "MITT001" = "SUNMITT001" (10)
function generateUsername(schoolName: string, schoolId: string): string {
  const nameClean = schoolName.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const available = Math.max(0, 10 - schoolId.length);
  const prefix = nameClean.slice(0, available);
  return (prefix + schoolId).slice(0, 10);
}

// New format: 6 chars of CRM ID, then a single class code char, then a 4-digit
// continuous sequence number. e.g. OLY202 + 5 + 0001 => "OLY20250001"
function buildCrmPrefix(crmId: string): string {
  return crmId.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
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
      district,
      districtCode,
      state,
      stateCode,
      pincode,
      classes, // [{ className: string, count: number }, ...]
    } = body;

    if (!name || !olympiadId || !state || !district) {
      return NextResponse.json(
        { message: 'School name, CRM ID, State, and District are required' },
        { status: 400 }
      );
    }

    // Validate per-class counts and resolve each to its single-char code (optional for bulk).
    const classRows: { className: string; classCode: string; count: number }[] = [];
    if (Array.isArray(classes) && classes.length > 0) {
      for (const c of classes) {
        const className = String(c?.className || '').trim();
        const cnt = parseInt(String(c?.count ?? '0'), 10);
        const classCode = CLASS_CODE_BY_NAME[className];
        if (!className || !classCode) {
          return NextResponse.json(
            { message: `Invalid class: ${className || '(empty)'}` },
            { status: 400 }
          );
        }
        if (!cnt || cnt < 1) {
          return NextResponse.json(
            { message: `Enter a valid student count for ${className}` },
            { status: 400 }
          );
        }
        classRows.push({ className, classCode, count: cnt });
      }

      const count = classRows.reduce((sum, c) => sum + c.count, 0);
      if (count > 2000) {
        return NextResponse.json(
          { message: 'Total students (sum of all classes) must not exceed 2000' },
          { status: 400 }
        );
      }
    }

    // Generate schoolId with retry on race condition
    for (let attempt = 0; attempt < 3; attempt++) {
      const schoolId = await generateSchoolId();
      const plainPassword = generatePassword(10);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      try {
        // Create school
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
            district,
            districtCode,
            state,
            stateCode: stateCode || stateNameToCode(state),
            pincode,
            username: generateUsername(name, schoolId),
            password: hashedPassword,
            plainPassword: plainPassword,
          },
        });

        // Auto-generate Olympiad IDs.
        // Format: [6 char CRM][1 char classCode][4 digit continuous seq]
        // The sequence number runs continuously across the whole school while
        // the class char changes per class. e.g. OLY202 5 0001, OLY202 5 0002,
        // OLY202 A 0003 ...
        const prefix = buildCrmPrefix(olympiadId);
        const now = new Date();

        let seq = 0;
        const olympiadIds = classRows.flatMap((cls) =>
          Array.from({ length: cls.count }, () => {
            seq += 1;
            const numStr = String(seq).padStart(4, '0');
            const code = `${prefix}${cls.classCode}${numStr}`;
            return {
              code,
              prefix,
              sequence: seq,
              classCode: cls.classCode,
              className: cls.className,
              schoolId: school.id,
              sentAt: now, // auto-sent since generated by admin at registration
            };
          })
        );

        const totalCount = classRows.reduce((sum, c) => sum + c.count, 0);

        if (olympiadIds.length > 0) {
          await prisma.olympiadIdAllocation.createMany({
            data: olympiadIds,
            skipDuplicates: true,
          });
        }

        const generatedUsername = generateUsername(name, schoolId);

        // Email the login credentials to the school's email (if provided).
        // Best-effort: a mail failure must not roll back a successful registration,
        // so we report emailSent/emailError instead of throwing.
        let emailSent = false;
        let emailError: string | null = null;
        if (email) {
          try {
            await sendSchoolCredentialsEmail({
              to: email,
              schoolName: name,
              schoolId,
              username: generatedUsername,
              password: plainPassword,
              contactPerson,
            });
            emailSent = true;
          } catch (mailErr: any) {
            emailError = mailErr?.message || 'Failed to send email';
            console.error(`Credential email to ${email} failed:`, mailErr);
          }
        }

        return NextResponse.json({
          ...school,
          olympiadIdsGenerated: totalCount,
          olympiadIdPrefix: classRows.length > 0 ? prefix : null,
          firstCode: olympiadIds[0]?.code ?? null,
          lastCode: olympiadIds[olympiadIds.length - 1]?.code ?? null,
          classBreakdown: classRows,
          credentials: {
            username: generatedUsername,
            password: plainPassword,
          },
          emailSent,
          emailError,
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
