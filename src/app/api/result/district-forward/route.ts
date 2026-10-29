import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { rankForDistrict, schoolIdsByCode, DISTRICT_TOP_N } from '@/lib/district-forward';

export const dynamic = 'force-dynamic';

// GET    /api/result/district-forward   the qualifying pool: top 10 distinct holistic %s across all
//                                       schools, everyone on them, and who is already forwarded
// POST   /api/result/district-forward   forward everyone currently in the pool
// DELETE /api/result/district-forward   { olympiadCode } withdraw one student, or { all: true } everyone
// Forwarding is always recomputed here from the live results, never taken from the client.

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const { topPercents, qualifying, byCode } = await rankForDistrict();

    // Tolerates the DistrictForward table not existing yet, so the page still loads.
    let tableReady = true;
    const forwards = new Map<string, { forwardedAt: Date; holisticPercent: number }>();
    try {
      for (const f of await prisma.districtForward.findMany({ select: { olympiadCode: true, forwardedAt: true, holisticPercent: true } })) {
        forwards.set(f.olympiadCode, f);
      }
    } catch (err) {
      tableReady = false;
      console.warn('result/district-forward: DistrictForward unavailable', err);
    }

    const inPool = new Set(qualifying.map(s => s.olympiadCode));
    const students = qualifying.map(s => ({
      ...s,
      forwarded: forwards.has(s.olympiadCode),
      forwardedAt: forwards.get(s.olympiadCode)?.forwardedAt ?? null,
      outOfPool: false,
    }));
    // Forwarded earlier but no longer in the pool (their result changed): keep them visible.
    for (const [code, f] of forwards) {
      if (inPool.has(code)) continue;
      const r = byCode.get(code);
      students.push({
        studentKey: r?.studentKey ?? code, name: r?.name ?? code, olympiadCode: code, className: r?.className ?? null,
        schoolName: r?.schoolName ?? null, schoolCode: r?.schoolId ?? null, state: r?.state ?? null, district: r?.district ?? null,
        holisticPercent: r?.holisticPercent ?? f.holisticPercent, rank: 0,
        forwarded: true, forwardedAt: f.forwardedAt, outOfPool: true,
      });
    }

    return NextResponse.json({ topN: DISTRICT_TOP_N, topPercents, tableReady, students });
  } catch (err: any) {
    console.error('GET result/district-forward failed:', err);
    return NextResponse.json({ message: 'Failed to load the state-level pool' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { payload, error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const [{ qualifying }, schoolIds] = await Promise.all([rankForDistrict(), schoolIdsByCode()]);
    const data = qualifying.flatMap(s => {
      const schoolId = s.schoolCode ? schoolIds.get(s.schoolCode) : undefined;
      return schoolId ? [{ olympiadCode: s.olympiadCode, schoolId, holisticPercent: s.holisticPercent, forwardedBy: payload?.id ?? null }] : [];
    });
    if (data.length === 0) return NextResponse.json({ message: 'Nobody is in the state-level pool yet' }, { status: 400 });
    // Already-forwarded students are left exactly as they were.
    const res = await prisma.districtForward.createMany({ data, skipDuplicates: true });
    return NextResponse.json({ forwarded: res.count, inPool: qualifying.length });
  } catch (err: any) {
    console.error('POST result/district-forward failed:', err);
    return NextResponse.json({ message: 'Failed to forward students' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const code = typeof body?.olympiadCode === 'string' ? body.olympiadCode.trim() : '';
    if (!code && body?.all !== true) return NextResponse.json({ message: 'Say which student, or all' }, { status: 400 });
    const res = await prisma.districtForward.deleteMany({ where: code ? { olympiadCode: code } : {} });
    return NextResponse.json({ withdrawn: res.count });
  } catch (err: any) {
    console.error('DELETE result/district-forward failed:', err);
    return NextResponse.json({ message: 'Failed to withdraw' }, { status: 500 });
  }
}
