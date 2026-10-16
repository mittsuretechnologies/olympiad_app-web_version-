import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { CLASS_CODE_BY_NAME } from '@/lib/classes';
import { buildOlympiadCode, olympiadPrefixForCrm } from '@/lib/olympiadIdFormat';
import { crmIdProblem } from '@/lib/schoolCrm';
import { sendSchoolCredentialsEmail } from '@/lib/mailer';
import { stateNameToCode } from '@/lib/indianStateCodes';
import { requireAdmin } from '@/lib/auth-guard';
import { encryptPassword, decryptPassword } from '@/lib/password-crypto';
import { recordAccessLog } from '@/lib/audit-log';

export async function GET(request: Request) {
  const { error, payload } = await requireAdmin(request, ['schools.register', 'schools.bulk', 'schools.view']);
  if (error) return error;
  try {
    // Paginated: ?page=1&pageSize=25&q=<name | School ID | CRM ID>
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10) || 25));

    const where: Prisma.SchoolWhereInput = q
      ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { schoolId: { contains: q, mode: 'insensitive' } },
          { olympiadId: { contains: q, mode: 'insensitive' } },
        ] }
      : {};

    const [schools, total, totalAll] = await Promise.all([
      prisma.school.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.school.count({ where }),
      prisma.school.count(),
    ]);
    await recordAccessLog(payload, {
      action: 'CREDENTIALS_VIEWED', entityType: 'School', subjectIds: schools.map((s) => s.id), request,
    });
    return NextResponse.json({
      schools: schools.map(({ password, ...s }) => ({ ...s, plainPassword: decryptPassword(s.plainPassword) })),
      total,
      totalAll,
      page,
      pageSize,
    });
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

export async function POST(request: Request) {
  const { error } = await requireAdmin(request, ['schools.register', 'schools.bulk', 'schools.view']);
  if (error) return error;
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
      examDate,
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

    // The CRM number is the Olympiad ID prefix, so it must be well-formed and
    // not already used by another school.
    const crmProblem = await crmIdProblem(olympiadId);
    if (crmProblem) {
      return NextResponse.json({ message: crmProblem }, { status: 400 });
    }
    const prefix = olympiadPrefixForCrm(olympiadId)!;

    // Generate schoolId with retry on race condition
    for (let attempt = 0; attempt < 3; attempt++) {
      const schoolId = await generateSchoolId();
      const plainPassword = generatePassword(10);
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      try {
        // Auto-generate Olympiad IDs (format: lib/olympiadIdFormat, e.g.
        // 112535N0001). The sequence runs continuously across the whole school
        // while the class char changes per class: 112535N0001, 112535N0002,
        // 112535L0003 ...
        const now = new Date();
        let seq = 0;
        const olympiadIds = classRows.flatMap((cls) =>
          Array.from({ length: cls.count }, () => {
            seq += 1;
            return {
              code: buildOlympiadCode(prefix, cls.classCode, seq),
              prefix,
              sequence: seq,
              classCode: cls.classCode,
              className: cls.className,
              sentAt: now, // auto-sent since generated by admin at registration
            };
          })
        );

        // School and its IDs land together: if any ID fails (e.g. a duplicate),
        // nothing is created and the retry below starts clean.
        const school = await prisma.$transaction(async (tx) => {
          const created = await tx.school.create({
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
              examDate: examDate ? new Date(examDate) : null,
              username: generateUsername(name, schoolId),
              password: hashedPassword,
              plainPassword: encryptPassword(plainPassword),
            },
          });
          if (olympiadIds.length > 0) {
            await tx.olympiadIdAllocation.createMany({
              data: olympiadIds.map((o) => ({ ...o, schoolId: created.id })),
            });
          }
          return created;
        });

        const totalCount = classRows.reduce((sum, c) => sum + c.count, 0);

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
              username: generatedUsername,
              password: plainPassword,
            });
            emailSent = true;
          } catch (mailErr: any) {
            emailError = mailErr?.message || 'Failed to send email';
            console.error(`Credential email to ${email} failed:`, mailErr);
          }
        }

        const { password: _schoolHash, plainPassword: _schoolEnc, ...schoolPublic } = school;
        return NextResponse.json({
          ...schoolPublic,
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
