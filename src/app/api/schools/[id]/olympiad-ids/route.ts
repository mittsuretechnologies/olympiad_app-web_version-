import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAccessLog, recordAuditLog } from '@/lib/audit-log';
import { CLASS_CODE_BY_NAME } from '@/lib/classes';
import { buildOlympiadCode, olympiadPrefixForCrm, OLYMPIAD_MAX_SEQUENCE } from '@/lib/olympiadIdFormat';
import { crmIdProblem } from '@/lib/schoolCrm';

type Db = Prisma.TransactionClient;

// An ID counts as allotted (and so can never be deleted) once anything points
// at it: a name the school entered, a web Student, an app account linked to it
// (Allot Student or the student typing it in the app), an attendance mark, or
// a self-registration still waiting for its OTP.
async function inUseCodes(db: Db, codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set();
  const [assigned, appUsers, attendance, pendingOtps] = await Promise.all([
    db.olympiadIdAllocation.findMany({
      where: { code: { in: codes }, OR: [{ assignedName: { not: null } }, { student: { isNot: null } }] },
      select: { code: true },
    }),
    db.appUser.findMany({ where: { olympiadId: { in: codes } }, select: { olympiadId: true } }),
    db.attendance.findMany({ where: { olympiadCode: { in: codes } }, select: { olympiadCode: true } }),
    db.studentRegistrationOtp.findMany({ where: { olympiadCode: { in: codes } }, select: { olympiadCode: true } }),
  ]);
  return new Set([
    ...assigned.map((a) => a.code),
    ...appUsers.map((u) => u.olympiadId!),
    ...attendance.map((a) => a.olympiadCode),
    ...pendingOtps.map((o) => o.olympiadCode),
  ]);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, payload } = await requireAdmin(request, 'schools.view');
  if (error) return error;
  try {
    const { id } = await params;
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: id },
      orderBy: [{ prefix: 'asc' }, { sequence: 'asc' }],
    });
    const inUse = await inUseCodes(prisma, allocations.map((a) => a.code));
    // Allocations carry the student and guardian names the school entered.
    await recordAccessLog(payload, {
      action: 'USER_DETAILS_VIEWED', entityType: 'OlympiadIdAllocation',
      subjectIds: allocations.filter((a) => a.assignedName).map((a) => a.id), request,
      details: { schoolId: id },
    });
    return NextResponse.json(allocations.map((a) => ({ ...a, inUse: inUse.has(a.code) })));
  } catch (error) {
    console.error('GET olympiad-ids failed:', error);
    return NextResponse.json({ message: 'Failed to fetch IDs' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request, 'schools.view');
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    // The ID format is fixed (see lib/olympiadIdFormat): the prefix comes from
    // the CRM ID and each class code from the class name, so the client
    // only says which classes and how many.
    const { classes } = body as { classes?: { className?: string; count?: number }[] };

    if (!Array.isArray(classes) || classes.length === 0) {
      return NextResponse.json({ message: 'Add at least one class' }, { status: 400 });
    }
    const rows: { className: string; classCode: string; count: number }[] = [];
    for (const c of classes) {
      const className = String(c?.className || '').trim();
      const classCode = CLASS_CODE_BY_NAME[className];
      if (!classCode) {
        return NextResponse.json({ message: `Invalid class: ${className || '(empty)'}` }, { status: 400 });
      }
      const count = Number(c?.count);
      if (!Number.isInteger(count) || count < 1) {
        return NextResponse.json({ message: `Enter a valid count for ${className}` }, { status: 400 });
      }
      rows.push({ className, classCode, count });
    }

    const totalCount = rows.reduce((sum, r) => sum + r.count, 0);
    if (totalCount > 1000) {
      return NextResponse.json(
        { message: 'Total count must be between 1 and 1000' },
        { status: 400 }
      );
    }

    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    // A malformed CRM, or one shared with another school, would give IDs that
    // are the wrong length or clash — fix the school's CRM ID first.
    const crmProblem = await crmIdProblem(school.olympiadId, school.id);
    if (crmProblem) {
      return NextResponse.json(
        { message: `${crmProblem} Correct the CRM ID before allocating Olympiad IDs.` },
        { status: 400 }
      );
    }
    const prefix = olympiadPrefixForCrm(school.olympiadId)!;

    const last = await prisma.olympiadIdAllocation.findFirst({
      where: { schoolId: id, prefix },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });

    const firstSeq = (last?.sequence ?? 0) + 1;
    if (firstSeq + totalCount - 1 > OLYMPIAD_MAX_SEQUENCE) {
      return NextResponse.json(
        { message: `This school can have at most ${OLYMPIAD_MAX_SEQUENCE} IDs; ${firstSeq - 1} already exist.` },
        { status: 400 }
      );
    }

    let seq = firstSeq;
    const allocations: {
      code: string;
      prefix: string;
      sequence: number;
      schoolId: string;
      classCode: string;
      className: string;
    }[] = [];

    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        allocations.push({
          code: buildOlympiadCode(prefix, row.classCode, seq),
          prefix,
          sequence: seq,
          schoolId: id,
          classCode: row.classCode,
          className: row.className,
        });
        seq++;
      }
    }

    const created = await prisma.$transaction(
      allocations.map((a) => prisma.olympiadIdAllocation.create({ data: a }))
    );

    return NextResponse.json({ created: created.length, allocations: created });
  } catch (error: any) {
    console.error('POST olympiad-ids failed:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { message: 'Duplicate ID detected. Someone may have just allocated IDs for this school; refresh and try again.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: 'Failed to allocate IDs' }, { status: 500 });
  }
}

// Removes IDs a school no longer needs (its student count went down). Only IDs
// no student has been given can go; the check is repeated inside the
// transaction so an allotment that lands mid-request is never deleted.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, payload } = await requireAdmin(request, 'schools.view');
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const codes = Array.isArray(body?.codes)
      ? [...new Set((body.codes as unknown[]).map((c) => String(c ?? '').trim()).filter(Boolean))]
      : [];
    if (codes.length === 0) {
      return NextResponse.json({ message: 'Select at least one ID to delete' }, { status: 400 });
    }
    if (codes.length > 1000) {
      return NextResponse.json({ message: 'You can delete at most 1000 IDs at a time' }, { status: 400 });
    }

    const school = await prisma.school.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const found = await tx.olympiadIdAllocation.findMany({
        where: { schoolId: id, code: { in: codes } },
        select: { code: true, className: true, sentAt: true },
      });
      if (found.length !== codes.length) {
        return { status: 404 as const, message: 'Some of these IDs do not belong to this school. Refresh and try again.' };
      }
      const inUse = await inUseCodes(tx, codes);
      if (inUse.size > 0) {
        return {
          status: 409 as const,
          message: `${inUse.size} of the selected IDs ${inUse.size === 1 ? 'has' : 'have'} already been allotted to a student and cannot be deleted: ${[...inUse].slice(0, 10).join(', ')}${inUse.size > 10 ? '…' : ''}`,
        };
      }
      const deleted = await tx.olympiadIdAllocation.deleteMany({
        where: { schoolId: id, code: { in: codes }, assignedName: null, student: { is: null } },
      });
      if (deleted.count !== codes.length) {
        throw new Error('Allotment changed while deleting');
      }
      return { status: 200 as const, deleted: found };
    });

    if (result.status !== 200) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName: payload.name || payload.email || null,
      action: 'OLYMPIAD_IDS_DELETED', entityType: 'School', entityId: school.id,
      previousValue: {
        count: result.deleted.length,
        codes: result.deleted.map((a) => a.code),
        sentToSchool: result.deleted.filter((a) => a.sentAt).length,
      },
      newValue: { schoolName: school.name },
    });

    return NextResponse.json({ deleted: result.deleted.length });
  } catch (error) {
    console.error('DELETE olympiad-ids failed:', error);
    return NextResponse.json({ message: 'Failed to delete IDs. Refresh and try again.' }, { status: 500 });
  }
}
