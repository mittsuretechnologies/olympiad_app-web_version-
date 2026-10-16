import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAccessLog } from '@/lib/audit-log';
import { CLASS_CODE_BY_NAME } from '@/lib/classes';
import { buildOlympiadCode, olympiadPrefixForCrm, OLYMPIAD_MAX_SEQUENCE } from '@/lib/olympiadIdFormat';
import { crmIdProblem } from '@/lib/schoolCrm';

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
    // Allocations carry the student and guardian names the school entered.
    await recordAccessLog(payload, {
      action: 'USER_DETAILS_VIEWED', entityType: 'OlympiadIdAllocation',
      subjectIds: allocations.filter((a) => a.assignedName).map((a) => a.id), request,
      details: { schoolId: id },
    });
    return NextResponse.json(allocations);
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
