import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';
import { STATE_TOP_N, stateLevelResults, stateToppers, winnerRows, type WinnerLevel } from '@/lib/state-result';

export const dynamic = 'force-dynamic';

// GET    /api/result/state-national             every State Level competitor's live result,
//                                               the live State Toppers and the frozen list
//                                               (see lib/state-result.ts)
// POST   /api/result/state-national { level }   freeze the State Toppers ('STATE'): the saved
//                                               rows are replaced by the live list right now
// DELETE /api/result/state-national { level }   un-freeze: remove the saved rows
// The lists are always computed here from live data, never taken from the client.
// National Winners have their own page and API (api/result/national): Level 3
// is scored on its own assessment and video, not on the State Level result.

const levelOf = (v: unknown): 'STATE' | null => (v === 'STATE' ? 'STATE' : null);

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const results = await stateLevelResults();

    // Tolerates the CompetitionWinner table not existing yet (SQL not run).
    let tableReady = true;
    let frozen: Awaited<ReturnType<typeof prisma.competitionWinner.findMany>> = [];
    try {
      frozen = await prisma.competitionWinner.findMany({ orderBy: [{ level: 'asc' }, { rank: 'asc' }, { name: 'asc' }] });
    } catch (err) {
      tableReady = false;
      console.warn('result/state-national: CompetitionWinner unavailable', err);
    }
    const frozenOf = (level: WinnerLevel) => {
      const rows = frozen.filter(r => r.level === level);
      return { frozenAt: rows[0]?.frozenAt ?? null, rows };
    };

    return NextResponse.json({
      stateTopN: STATE_TOP_N,
      tableReady,
      competitors: results,
      stateToppers: stateToppers(results),
      frozen: { STATE: frozenOf('STATE') },
    });
  } catch (err) {
    console.error('GET result/state-national failed:', err);
    return NextResponse.json({ message: 'Failed to load the State Level result' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { payload, error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const level = levelOf(body?.level);
    if (!level) return NextResponse.json({ message: "Say which list: 'STATE'" }, { status: 400 });

    const rows = winnerRows(level, await stateLevelResults(), payload?.id ?? null);
    if (rows.length === 0) return NextResponse.json({ message: 'Nobody is on this list yet' }, { status: 400 });

    await prisma.$transaction([
      prisma.competitionWinner.deleteMany({ where: { level } }),
      prisma.competitionWinner.createMany({ data: rows }),
    ]);
    await recordAuditLog({
      actorId: payload?.id ?? null,
      actorRole: payload?.role ?? null,
      actorName: payload?.name || payload?.email || null,
      action: 'STATE_TOPPERS_FROZEN',
      entityType: 'CompetitionWinner',
      entityId: level,
      newValue: { level, students: rows.length, ranks: rows.map(r => ({ rank: r.rank, olympiadCode: r.olympiadCode, state: r.state, percent: r.stateHolisticPercent })) },
    }).catch(() => {});
    return NextResponse.json({ level, frozen: rows.length });
  } catch (err) {
    console.error('POST result/state-national failed:', err);
    return NextResponse.json({ message: 'Failed to freeze the list' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { payload, error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const body = await request.json().catch(() => ({}));
    const level = levelOf(body?.level);
    if (!level) return NextResponse.json({ message: "Say which list: 'STATE'" }, { status: 400 });
    const res = await prisma.competitionWinner.deleteMany({ where: { level } });
    await recordAuditLog({
      actorId: payload?.id ?? null,
      actorRole: payload?.role ?? null,
      actorName: payload?.name || payload?.email || null,
      action: 'STATE_TOPPERS_UNFROZEN',
      entityType: 'CompetitionWinner',
      entityId: level,
      newValue: { level, removed: res.count },
    }).catch(() => {});
    return NextResponse.json({ level, removed: res.count });
  } catch (err) {
    console.error('DELETE result/state-national failed:', err);
    return NextResponse.json({ message: 'Failed to un-freeze the list' }, { status: 500 });
  }
}
