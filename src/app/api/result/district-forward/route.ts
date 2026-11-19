import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { rankForDistrict, schoolIdsByCode, DISTRICT_TOP_N } from '@/lib/district-forward';
import type { ExamSource } from '@/lib/result-overview';

export const dynamic = 'force-dynamic';

// GET    /api/result/district-forward?examSource=manual|ai   the Level 2 pool: per district, the
//                                       top 10 distinct holistic %s and everyone on them, plus who
//                                       is already forwarded
// POST   /api/result/district-forward   { examSource } forward everyone currently in the pool
// DELETE /api/result/district-forward   { olympiadCode, reason } withdraw one student,
//                                       or { all: true, reason } everyone
// Forwarding is always recomputed here from the live results, never taken from the client.
// examSource is the Result page's Manual / AI exam-marks toggle (Manual if not
// given). Each forward saves it, with the student's stage-1 kosha %s, so the
// State Level result is built on exactly the result that qualified them.
// Once anyone is forwarded on one exam source, forwarding on the other is
// refused: otherwise two forwards would send the union of both pools.

const examSourceOf = (v: unknown): ExamSource => (v === 'ai' ? 'ai' : 'manual');

/** The exam source the existing forwards were made on, or null when there are none (or only pre-2026-11-17 rows). */
async function lockedExamSource(): Promise<ExamSource | null> {
  try {
    const row = await prisma.districtForward.findFirst({ where: { examSource: { not: null } }, select: { examSource: true } });
    return row?.examSource ? examSourceOf(row.examSource) : null;
  } catch { return null; /* column not added yet */ }
}

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const examSource = examSourceOf(new URL(request.url).searchParams.get('examSource'));
    const { districts, qualifying, byCode, waitingForExam, noDistrict } = await rankForDistrict(examSource);

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
    // Forwarded earlier but no longer in their district's pool (their result changed): keep them visible.
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

    return NextResponse.json({
      topN: DISTRICT_TOP_N,
      examSource,
      lockedExamSource: tableReady ? await lockedExamSource() : null,
      districts: districts.map(d => ({ key: d.key, district: d.district, state: d.state, eligible: d.eligible, topPercents: d.topPercents, inPool: d.students.length })),
      waitingForExam,
      noDistrict,
      tableReady,
      students,
    });
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
    const locked = await lockedExamSource();
    if (locked && locked !== examSource) {
      return NextResponse.json({
        message: `Students are already forwarded on ${locked === 'ai' ? 'AI' : 'Manual'} exam marks. Forward on those marks too, or withdraw everyone first.`,
      }, { status: 409 });
    }

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
    const already = new Set((await prisma.districtForward.findMany({
      where: { olympiadCode: { in: data.map(d => d.olympiadCode) } }, select: { olympiadCode: true },
    })).map(f => f.olympiadCode));
    const res = await prisma.districtForward.createMany({ data, skipDuplicates: true });

    await recordAuditLog({
      actorId: payload?.id ?? null,
      actorRole: payload?.role ?? null,
      actorName: payload?.name || payload?.email || null,
      action: 'STATE_LEVEL_FORWARDED',
      entityType: 'DistrictForward',
      entityId: 'LIST',
      newValue: {
        examSource, forwarded: res.count, inPool: qualifying.length,
        olympiadCodes: data.filter(d => !already.has(d.olympiadCode)).map(d => d.olympiadCode),
      },
    }).catch(() => {});
    return NextResponse.json({ forwarded: res.count, inPool: qualifying.length });
  } catch (err: any) {
    console.error('POST result/district-forward failed:', err);
    return NextResponse.json({ message: 'Failed to forward students' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { payload, error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const code = typeof body?.olympiadCode === 'string' ? body.olympiadCode.trim() : '';
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!code && body?.all !== true) return NextResponse.json({ message: 'Say which student, or all' }, { status: 400 });
    if (!reason) return NextResponse.json({ message: 'Give a reason for the withdrawal' }, { status: 400 });

    const where = code ? { olympiadCode: code } : {};
    const removed = await prisma.districtForward.findMany({ where, select: { olympiadCode: true, holisticPercent: true } });
    const res = await prisma.districtForward.deleteMany({ where });

    await recordAuditLog({
      actorId: payload?.id ?? null,
      actorRole: payload?.role ?? null,
      actorName: payload?.name || payload?.email || null,
      action: 'STATE_LEVEL_WITHDRAWN',
      entityType: 'DistrictForward',
      entityId: code || 'ALL',
      previousValue: { students: removed },
      newValue: { withdrawn: res.count },
      reason,
    }).catch(() => {});
    return NextResponse.json({ withdrawn: res.count });
  } catch (err: any) {
    console.error('DELETE result/district-forward failed:', err);
    return NextResponse.json({ message: 'Failed to withdraw' }, { status: 500 });
  }
}
