import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const allocations = await prisma.olympiadIdAllocation.findMany({
      where: { schoolId: id },
      orderBy: [{ prefix: 'asc' }, { sequence: 'asc' }],
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
  try {
    const { id } = await params;
    const body = await request.json();
    const { prefix, count, padding = 4, classes } = body as {
      prefix?: string;
      count?: number;
      padding?: number;
      classes?: { classCode?: string; className?: string; count: number }[];
    };

    if (!prefix || !prefix.trim()) {
      return NextResponse.json({ message: 'Prefix is required' }, { status: 400 });
    }

    // Either a flat `count`, or a per-class breakdown (`classes`) — normalize
    // both into one list of { classCode, className, count } rows.
    const rows = Array.isArray(classes) && classes.length > 0
      ? classes
      : [{ classCode: undefined, className: undefined, count: count ?? 0 }];

    const totalCount = rows.reduce((sum, r) => sum + (r.count || 0), 0);
    if (!totalCount || totalCount < 1 || totalCount > 1000) {
      return NextResponse.json(
        { message: 'Total count must be between 1 and 1000' },
        { status: 400 }
      );
    }
    if (rows.some((r) => !r.count || r.count < 1)) {
      return NextResponse.json(
        { message: 'Each class must have a count of at least 1' },
        { status: 400 }
      );
    }

    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    const cleanPrefix = prefix.trim();
    const padLen = Math.max(padding, 1);

    const last = await prisma.olympiadIdAllocation.findFirst({
      where: { schoolId: id, prefix: cleanPrefix },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });

    let seq = (last?.sequence ?? 0) + 1;
    const allocations: {
      code: string;
      prefix: string;
      sequence: number;
      schoolId: string;
      classCode?: string;
      className?: string;
    }[] = [];

    for (const row of rows) {
      const classCode = row.classCode?.trim() || undefined;
      for (let i = 0; i < row.count; i++) {
        const code = `${cleanPrefix}${classCode ?? ''}${String(seq).padStart(padLen, '0')}`;
        allocations.push({
          code,
          prefix: cleanPrefix,
          sequence: seq,
          schoolId: id,
          classCode,
          className: row.className?.trim() || undefined,
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
        { message: 'Duplicate ID detected. Try again or change prefix.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: 'Failed to allocate IDs' }, { status: 500 });
  }
}
