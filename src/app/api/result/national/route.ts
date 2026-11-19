import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import {
  NATIONAL_TOP_N, nationalCandidates, nationalLevelResults, nationalWinnerRows, nationalWinners,
} from '@/lib/national-result';

export const dynamic = 'force-dynamic';

// Result → National Level (lib/national-result.ts).
// GET                                                    candidates (state Rank 1s on the frozen State
//                                                        Toppers list), competitors' live National %,
//                                                        the live and frozen National Winners
// POST   { action: 'forward' }                           forward every candidate not forwarded yet
// POST   { action: 'assessment', olympiadCode, score, max }   save Virtual Assessment marks
//                                                        (score null clears them)
// POST   { action: 'freeze' }                            save the live National Winners as the frozen list
// DELETE { action: 'withdraw', olympiadCode, reason }    withdraw one competitor
// DELETE { action: 'unfreeze' }                          remove the frozen National Winners
// Everything is recomputed here from live data, never taken from the client.

type Payload = { id?: string; role?: string; name?: string; email?: string } | null | undefined;
const actorOf = (p: Payload) => ({ actorId: p?.id ?? null, actorRole: p?.role ?? null, actorName: p?.name || p?.email || null });

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    // Tolerates the NationalForward table not existing yet (SQL not run).
    let tableReady = true;
    let competitors: Awaited<ReturnType<typeof nationalLevelResults>> = [];
    try {
      competitors = await nationalLevelResults();
    } catch (err) {
      tableReady = false;
      console.warn('result/national: NationalForward unavailable', err);
    }

    let stateFrozen = false;
    let candidates: Awaited<ReturnType<typeof nationalCandidates>>['candidates'] = [];
    let frozenRows: Awaited<ReturnType<typeof prisma.competitionWinner.findMany>> = [];
    try {
      ({ stateFrozen, candidates } = await nationalCandidates());
      frozenRows = await prisma.competitionWinner.findMany({ where: { level: 'NATIONAL' }, orderBy: [{ rank: 'asc' }, { name: 'asc' }] });
    } catch (err) {
      console.warn('result/national: CompetitionWinner unavailable', err);
    }

    const forwarded = new Set(competitors.map(c => c.olympiadCode));
    return NextResponse.json({
      topN: NATIONAL_TOP_N,
      tableReady,
      stateFrozen,
      candidates: candidates.map(c => ({ ...c, forwarded: forwarded.has(c.olympiadCode) })),
      competitors,
      winners: nationalWinners(competitors),
      frozen: { frozenAt: frozenRows[0]?.frozenAt ?? null, rows: frozenRows },
    });
  } catch (err) {
    console.error('GET result/national failed:', err);
    return NextResponse.json({ message: 'Failed to load the National Level result' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { payload, error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'forward') {
      const { stateFrozen, candidates } = await nationalCandidates();
      if (!stateFrozen) return NextResponse.json({ message: 'Freeze the State Toppers first (Result → State Toppers).' }, { status: 400 });
      if (candidates.length === 0) return NextResponse.json({ message: 'Nobody is Rank 1 on the frozen State Toppers list' }, { status: 400 });
      const already = new Set((await prisma.nationalForward.findMany({ select: { olympiadCode: true } })).map(f => f.olympiadCode));
      const data = candidates.filter(c => !already.has(c.olympiadCode)).map(c => ({ ...c, forwardedBy: payload?.id ?? null }));
      if (data.length === 0) return NextResponse.json({ forwarded: 0 });
      const res = await prisma.nationalForward.createMany({ data, skipDuplicates: true });
      await recordAuditLog({
        ...actorOf(payload) as any,
        action: 'NATIONAL_LEVEL_FORWARDED', entityType: 'NationalForward', entityId: 'LIST',
        newValue: { forwarded: res.count, olympiadCodes: data.map(d => d.olympiadCode) },
      }).catch(() => {});
      return NextResponse.json({ forwarded: res.count });
    }

    if (action === 'assessment') {
      const code = typeof body?.olympiadCode === 'string' ? body.olympiadCode.trim() : '';
      if (!code) return NextResponse.json({ message: 'Say which student' }, { status: 400 });
      const existing = await prisma.nationalForward.findUnique({ where: { olympiadCode: code } });
      if (!existing) return NextResponse.json({ message: 'This student is not at the National Level' }, { status: 404 });

      const clear = body?.score === null || body?.score === '';
      const score = Number(body?.score);
      const max = Number(body?.max);
      if (!clear && (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0 || score < 0 || score > max)) {
        return NextResponse.json({ message: 'Marks must be a number from 0 to the maximum, and the maximum more than 0' }, { status: 400 });
      }
      const data = clear
        ? { assessmentScore: null, assessmentMax: null, assessmentBy: payload?.id ?? null, assessmentAt: new Date() }
        : { assessmentScore: score, assessmentMax: max, assessmentBy: payload?.id ?? null, assessmentAt: new Date() };
      await prisma.nationalForward.update({ where: { olympiadCode: code }, data });
      await recordAuditLog({
        ...actorOf(payload) as any,
        action: 'NATIONAL_ASSESSMENT_ENTERED', entityType: 'NationalForward', entityId: code,
        previousValue: { score: existing.assessmentScore, max: existing.assessmentMax },
        newValue: clear ? { score: null, max: null } : { score, max },
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    if (action === 'freeze') {
      const rows = nationalWinnerRows(await nationalLevelResults(), payload?.id ?? null);
      if (rows.length === 0) return NextResponse.json({ message: 'Nobody is on this list yet' }, { status: 400 });
      await prisma.$transaction([
        prisma.competitionWinner.deleteMany({ where: { level: 'NATIONAL' } }),
        prisma.competitionWinner.createMany({ data: rows }),
      ]);
      await recordAuditLog({
        ...actorOf(payload) as any,
        action: 'NATIONAL_WINNERS_FROZEN', entityType: 'CompetitionWinner', entityId: 'NATIONAL',
        newValue: { level: 'NATIONAL', students: rows.length, ranks: rows.map(r => ({ rank: r.rank, olympiadCode: r.olympiadCode, state: r.state, percent: r.nationalPercent })) },
      }).catch(() => {});
      return NextResponse.json({ frozen: rows.length });
    }

    return NextResponse.json({ message: "Say what to do: 'forward', 'assessment' or 'freeze'" }, { status: 400 });
  } catch (err) {
    console.error('POST result/national failed:', err);
    return NextResponse.json({ message: 'Failed to save' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { payload, error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));

    if (body?.action === 'withdraw') {
      const code = typeof body?.olympiadCode === 'string' ? body.olympiadCode.trim() : '';
      const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
      if (!code) return NextResponse.json({ message: 'Say which student' }, { status: 400 });
      if (!reason) return NextResponse.json({ message: 'Give a reason for the withdrawal' }, { status: 400 });
      const removed = await prisma.nationalForward.findMany({ where: { olympiadCode: code } });
      const res = await prisma.nationalForward.deleteMany({ where: { olympiadCode: code } });
      await recordAuditLog({
        ...actorOf(payload) as any,
        action: 'NATIONAL_LEVEL_WITHDRAWN', entityType: 'NationalForward', entityId: code,
        previousValue: { students: removed }, newValue: { withdrawn: res.count }, reason,
      }).catch(() => {});
      return NextResponse.json({ withdrawn: res.count });
    }

    if (body?.action === 'unfreeze') {
      const res = await prisma.competitionWinner.deleteMany({ where: { level: 'NATIONAL' } });
      await recordAuditLog({
        ...actorOf(payload) as any,
        action: 'NATIONAL_WINNERS_UNFROZEN', entityType: 'CompetitionWinner', entityId: 'NATIONAL',
        newValue: { level: 'NATIONAL', removed: res.count },
      }).catch(() => {});
      return NextResponse.json({ removed: res.count });
    }

    return NextResponse.json({ message: "Say what to do: 'withdraw' or 'unfreeze'" }, { status: 400 });
  } catch (err) {
    console.error('DELETE result/national failed:', err);
    return NextResponse.json({ message: 'Failed to remove' }, { status: 500 });
  }
}
