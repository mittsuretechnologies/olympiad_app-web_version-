import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { recordAuditLog } from '@/lib/audit-log';

// Evaluator -> School assignment (Evaluator -> Assign Schools).
// GET  -> every school + which evaluators it is assigned to + its approved /
//         still-unscored evaluation video counts, and the evaluator list.
// POST -> { schoolIds, evaluatorIds, mode: 'add' | 'replace' | 'remove' }
//   add     give these evaluators the schools (others keep them too)
//   replace the schools belong ONLY to these evaluators (others lose them;
//           an empty evaluatorIds clears the schools) — avoids duplicate work
//   remove  take the schools away from these evaluators only
// Only assignment rows change; evaluations already submitted are untouched.

const MODULE = 'evaluator.manage';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, MODULE);
  if (error) return error;
  try {
    const [schools, evaluators, links, studentVideos, appVideos] = await Promise.all([
      prisma.school.findMany({
        select: { id: true, schoolId: true, name: true, city: true, district: true, state: true, stateCode: true, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.talentEvaluator.findMany({
        select: { id: true, evaluatorId: true, name: true, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.evaluatorSchool.findMany({ select: { evaluatorId: true, schoolId: true } }),
      prisma.video.findMany({
        where: { isEvaluation: true, status: 'APPROVED', deletedAt: null, studentId: { not: null } },
        select: { _count: { select: { evaluations: true } }, student: { select: { allocation: { select: { schoolId: true } } } } },
      }),
      prisma.video.findMany({
        where: { isEvaluation: true, status: 'APPROVED', deletedAt: null, appUserId: { not: null } },
        select: { _count: { select: { evaluations: true } }, appUserId: true },
      }),
    ]);

    // App-user videos reach their school through the user's Olympiad ID.
    const appUserIds = [...new Set(appVideos.map(v => v.appUserId!).filter(Boolean))];
    const appUsers = appUserIds.length
      ? await prisma.appUser.findMany({ where: { id: { in: appUserIds } }, select: { id: true, olympiadId: true } })
      : [];
    const codeByUser = new Map(appUsers.map(u => [u.id, u.olympiadId]));
    const codes = [...new Set(appUsers.map(u => u.olympiadId).filter(Boolean) as string[])];
    const allocs = codes.length
      ? await prisma.olympiadIdAllocation.findMany({ where: { code: { in: codes } }, select: { code: true, schoolId: true } })
      : [];
    const schoolByCode = new Map(allocs.map(a => [a.code, a.schoolId]));

    const videos = new Map<string, number>();
    const pending = new Map<string, number>();
    const count = (schoolId: string | null | undefined, scored: boolean) => {
      if (!schoolId) return;
      videos.set(schoolId, (videos.get(schoolId) || 0) + 1);
      if (!scored) pending.set(schoolId, (pending.get(schoolId) || 0) + 1);
    };
    for (const v of studentVideos) count(v.student?.allocation?.schoolId, v._count.evaluations > 0);
    for (const v of appVideos) {
      const code = v.appUserId ? codeByUser.get(v.appUserId) : null;
      count(code ? schoolByCode.get(code) : null, v._count.evaluations > 0);
    }

    const bySchool = new Map<string, string[]>();
    for (const l of links) {
      if (!bySchool.has(l.schoolId)) bySchool.set(l.schoolId, []);
      bySchool.get(l.schoolId)!.push(l.evaluatorId);
    }

    return NextResponse.json({
      evaluators,
      schools: schools.map(s => ({
        ...s,
        evaluatorIds: bySchool.get(s.id) || [],
        videos: videos.get(s.id) || 0,
        pending: pending.get(s.id) || 0,
      })),
    });
  } catch (e: any) {
    console.error('GET evaluator/assignments failed:', e);
    return NextResponse.json({ message: 'Failed to load assignments' }, { status: 500 });
  }
}

const uniqueStrings = (v: unknown): string[] =>
  [...new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string'))];

export async function POST(request: Request) {
  const { error, payload } = await requireAdmin(request, MODULE);
  if (error) return error;
  try {
    const body = await request.json();
    const mode = body.mode;
    const schoolIds = uniqueStrings(body.schoolIds);
    const evaluatorIds = uniqueStrings(body.evaluatorIds);

    if (!['add', 'replace', 'remove'].includes(mode)) return NextResponse.json({ message: 'Invalid mode' }, { status: 400 });
    if (schoolIds.length === 0) return NextResponse.json({ message: 'Select at least one school' }, { status: 400 });
    if (evaluatorIds.length === 0 && mode !== 'replace') return NextResponse.json({ message: 'Select at least one evaluator' }, { status: 400 });

    const [validSchools, validEvaluators] = await Promise.all([
      prisma.school.count({ where: { id: { in: schoolIds } } }),
      prisma.talentEvaluator.count({ where: { id: { in: evaluatorIds } } }),
    ]);
    if (validSchools !== schoolIds.length) return NextResponse.json({ message: 'Some schools were not found' }, { status: 400 });
    if (validEvaluators !== evaluatorIds.length) return NextResponse.json({ message: 'Some evaluators were not found' }, { status: 400 });

    const pairs = schoolIds.flatMap(schoolId => evaluatorIds.map(evaluatorId => ({ evaluatorId, schoolId, assignedBy: payload.id })));

    await prisma.$transaction(async (tx) => {
      if (mode === 'remove') {
        await tx.evaluatorSchool.deleteMany({ where: { schoolId: { in: schoolIds }, evaluatorId: { in: evaluatorIds } } });
        return;
      }
      if (mode === 'replace') {
        await tx.evaluatorSchool.deleteMany({ where: { schoolId: { in: schoolIds }, evaluatorId: { notIn: evaluatorIds } } });
      }
      if (pairs.length) await tx.evaluatorSchool.createMany({ data: pairs, skipDuplicates: true });
    });

    await recordAuditLog({
      actorId: payload.id,
      actorRole: payload.role,
      actorName: payload.name || payload.email || payload.username || null,
      action: 'EVALUATOR_SCHOOLS_ASSIGNED',
      entityType: 'TalentEvaluator',
      entityId: evaluatorIds.length === 1 ? evaluatorIds[0] : 'LIST',
      newValue: { mode, schoolCount: schoolIds.length, schoolIds: schoolIds.slice(0, 200), evaluatorIds },
    });

    return NextResponse.json({ ok: true, mode, schools: schoolIds.length, evaluators: evaluatorIds.length });
  } catch (e: any) {
    console.error('POST evaluator/assignments failed:', e);
    return NextResponse.json({ message: 'Failed to save assignments' }, { status: 500 });
  }
}
