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
    const { prefix, count, padding = 4 } = body as {
      prefix?: string;
      count?: number;
      padding?: number;
    };

    if (!prefix || !prefix.trim()) {
      return NextResponse.json({ message: 'Prefix is required' }, { status: 400 });
    }
    if (!count || count < 1 || count > 1000) {
      return NextResponse.json(
        { message: 'Count must be between 1 and 1000' },
        { status: 400 }
      );
    }

    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) {
      return NextResponse.json({ message: 'School not found' }, { status: 404 });
    }

    const cleanPrefix = prefix.trim();

    const last = await prisma.olympiadIdAllocation.findFirst({
      where: { schoolId: id, prefix: cleanPrefix },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });

    const startSeq = (last?.sequence ?? 0) + 1;
    const padLen = Math.max(padding, 1);

    const allocations = Array.from({ length: count }, (_, i) => {
      const seq = startSeq + i;
      const code = `${cleanPrefix}${String(seq).padStart(padLen, '0')}`;
      return { code, prefix: cleanPrefix, sequence: seq, schoolId: id };
    });

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
