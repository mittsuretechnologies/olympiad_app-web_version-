import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { rankForDistrict, schoolIdsByCode, DISTRICT_TOP_N } from '@/lib/district-forward';
import type { ExamSource } from '@/lib/result-overview';

export const dynamic = 'force-dynamic';

// GET    /api/result/district-forward?examSource=manual|ai   the qualifying pool: top 3 distinct
//                                       holistic %s across all schools, everyone on them, and who is
//                                       already forwarded
// POST   /api/result/district-forward   { examSource } forward everyone currently in the pool
// DELETE /api/result/district-forward   { olympiadCode } withdraw one student, or { all: true } everyone
// Forwarding is always recomputed here from the live results, never taken from the client.
// examSource is the Result page's Manual / AI exam-marks toggle (Manual if not
// given). Each forward saves it, with the student's stage-1 kosha %s, so the
// State Level result is built on exactly the result that qualified them.

const examSourceOf = (v: unknown): ExamSource => (v === 'ai' ? 'ai' : 'manual');

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const examSource = examSourceOf(new URL(request.url).searchParams.get('examSource'));
    const { topPercents, qualifying, byCode } = await rankForDistrict(examSource);

    // Tolerates the DistrictForward table not existing yet, so the page still loads.
    let tableReady = true;
    const forwards = new Map<string, { forwardedAt: Date; holisticPercent: number; examSource: string | null }>();
    try {
      for (const f of await prisma.districtForward.findMany({ select: { olympiadCode: true, forwardedAt: true, holisticPercent: true } })) {
        forwards.set(f.olympiadCode, { ...f, examSource: null });
      }
      // Separate read: works before the 2026-11-17 columns exist.
      try {
        for (const f of await prisma.districtForward.findMany({ select: { olympiadCode: true, examSource: true } })) {
          const row = forwards.get(f.olympiadCode);
          if (row) row.examSource = f.examSource;
        }
      } catch { /* columns not added yet */ }
    } catch (err) {
      tableReady = false;
      console.warn('result/district-forward: DistrictForward unavailable', err);
    }

    const inPool = new Set(qualifying.map(s => s.olympiadCode));
    const students = qualifying.map(s => ({
      ...s,
      forwarded: forwards.has(s.olympiadCode),
      forwardedAt: forwards.get(s.olympiadCode)?.forwardedAt ?? null,
      forwardedExamSource: forwards.get(s.olympiadCode)?.examSource ?? null,
      outOfPool: false,
    }));
    // Forwarded earlier but no longer in the pool (their result changed): keep them visible.
    for (const [code, f] of forwards) {
      if (inPool.has(code)) continue;
      const r = byCode.get(code);
      students.push({
        studentKey: r?.studentKey ?? code, name: r?.name ?? code, olympiadCode: code, className: r?.className ?? null,
        schoolName: r?.schoolName ?? null, schoolCode: r?.schoolId ?? null, state: r?.state ?? null, district: r?.district ?? null,
        holisticPercent: r?.holisticPercent ?? f.holisticPercent, rank: 0, koshPercents: {},
        forwarded: true, forwardedAt: f.forwardedAt, forwardedExamSource: f.examSource, outOfPool: true,
      });
    }

    return NextResponse.json({ topN: DISTRICT_TOP_N, examSource, topPercents, tableReady, students });
  } catch (err: any) {
    console.error('GET result/district-forward failed:', err);
    return NextResponse.json({ message: 'Failed to load the state-level pool' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { payload, error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const examSource = examSourceOf(body?.examSource);
    const [{ qualifying }, schoolIds] = await Promise.all([rankForDistrict(examSource), schoolIdsByCode()]);
    const data = qualifying.flatMap(s => {
      const schoolId = s.schoolCode ? schoolIds.get(s.schoolCode) : undefined;
      return schoolId ? [{
        olympiadCode: s.olympiadCode, schoolId, holisticPercent: s.holisticPercent, forwardedBy: payload?.id ?? null,
        examSource, koshPercents: s.koshPercents,
      }] : [];
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
