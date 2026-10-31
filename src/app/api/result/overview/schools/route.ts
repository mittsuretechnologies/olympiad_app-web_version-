import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { REQUIRED_VIDEOS } from '@/lib/kosh';
import { SCHOOL_ROUND_VIDEOS } from '@/lib/olympiad-categories';
import { normaliseQuery, schoolMatchesQuery, studentMatchesQuery } from '@/lib/resultSearch';

export const dynamic = 'force-dynamic';

// GET /api/result/overview/schools — one PAGE of schools for the Result page.
//   page, pageSize (≤100), q (school or student), state, status (Complete|Incomplete)
// Only light columns are read (no exam-scanner data, no per-student detail), and
// the response carries just the requested page plus the totals for the filter.
// A school's students are loaded separately, when it is opened:
//   GET /api/result/overview?schoolId=<school code>
// "Complete" = both required videos approved AND their evaluations published,
// the same rule the student list uses.

type Member = { schoolId: string; cls: string; name: string; code: string; complete: boolean };

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'result');
  if (error) return error;
  try {
    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20));
    const q = normaliseQuery(sp.get('q'));
    const state = (sp.get('state') || '').trim();
    const status = sp.get('status') === 'Complete' || sp.get('status') === 'Incomplete' ? sp.get('status')! : '';

    const [schools, allocations, students, appUsers, videos] = await Promise.all([
      prisma.school.findMany({ select: { id: true, schoolId: true, name: true, city: true, district: true, state: true } }),
      prisma.olympiadIdAllocation.findMany({
        where: { assignedAt: { not: null } },
        select: { code: true, classCode: true, className: true, assignedName: true, schoolId: true },
      }),
      prisma.student.findMany({ select: { id: true, name: true, olympiadCode: true } }),
      prisma.appUser.findMany({ where: { olympiadId: { not: null } }, select: { id: true, userId: true, olympiadId: true } }),
      prisma.video.findMany({
        where: { isEvaluation: true, status: 'APPROVED', deletedAt: null, ...SCHOOL_ROUND_VIDEOS },
        select: { studentId: true, appUserId: true, evaluations: { select: { isPublished: true } } },
      }),
    ]);

    // Per student/app user: approved videos and how many have a published evaluation.
    const progress = new Map<string, { n: number; published: number }>();
    for (const v of videos) {
      const key = v.studentId ?? v.appUserId;
      if (!key) continue;
      const cur = progress.get(key) || { n: 0, published: 0 };
      cur.n += 1;
      if (v.evaluations[0]?.isPublished) cur.published += 1;
      progress.set(key, cur);
    }
    const isComplete = (key: string) => {
      const p = progress.get(key);
      return !!p && p.n >= REQUIRED_VIDEOS && p.published >= REQUIRED_VIDEOS;
    };

    const allocByCode = new Map(allocations.map(a => [a.code, a]));
    const members: Member[] = [];
    for (const s of students) {
      const a = allocByCode.get(s.olympiadCode);
      if (!a) continue;
      members.push({ schoolId: a.schoolId, cls: a.className || a.classCode || 'No class', name: a.assignedName || s.name, code: s.olympiadCode, complete: isComplete(s.id) });
    }
    for (const u of appUsers) {
      const a = u.olympiadId ? allocByCode.get(u.olympiadId) : null;
      if (!a) continue;
      members.push({ schoolId: a.schoolId, cls: a.className || a.classCode || 'No class', name: a.assignedName || u.userId, code: u.olympiadId || '-', complete: isComplete(u.id) });
    }

    const schoolById = new Map(schools.map(s => [s.id, s]));
    const schoolQueryMatch = new Map<string, boolean>();
    const agg = new Map<string, { students: number; complete: number; classes: Set<string> }>();
    for (const m of members) {
      const sc = schoolById.get(m.schoolId);
      if (!sc) continue;
      if (state && sc.state !== state) continue;
      let schoolHit = schoolQueryMatch.get(sc.id);
      if (schoolHit === undefined) { schoolHit = schoolMatchesQuery(q, sc); schoolQueryMatch.set(sc.id, schoolHit); }
      if (!schoolHit && !studentMatchesQuery(q, m)) continue;
      if (status && (m.complete ? 'Complete' : 'Incomplete') !== status) continue;
      const cur = agg.get(sc.id) || { students: 0, complete: 0, classes: new Set<string>() };
      cur.students += 1;
      if (m.complete) cur.complete += 1;
      cur.classes.add(m.cls);
      agg.set(sc.id, cur);
    }

    // Which of these schools have had their passports released. Tolerates the
    // PassportRelease table not existing yet, so this page keeps working until
    // the migration has been applied.
    const releasedAt = new Map<string, Date>();
    try {
      const releases = await prisma.passportRelease.findMany({ select: { schoolId: true, releasedAt: true } });
      for (const r of releases) releasedAt.set(r.schoolId, r.releasedAt);
    } catch (err) {
      console.warn('result/overview/schools: PassportRelease unavailable', err);
    }

    const rows = Array.from(agg.entries())
      .map(([id, a]) => {
        const sc = schoolById.get(id)!;
        return {
          schoolId: sc.schoolId, name: sc.name, city: sc.city, district: sc.district, state: sc.state,
          students: a.students, classes: a.classes.size, complete: a.complete, incomplete: a.students - a.complete,
          passportReleasedAt: releasedAt.get(id) ?? null,
        };
      })
      .sort((x, y) => x.name.localeCompare(y.name));

    const totals = rows.reduce(
      (t, r) => ({ schools: t.schools + 1, students: t.students + r.students, complete: t.complete + r.complete, incomplete: t.incomplete + r.incomplete }),
      { schools: 0, students: 0, complete: 0, incomplete: 0 },
    );
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const safePage = Math.min(page, totalPages);

    return NextResponse.json({
      schools: rows.slice((safePage - 1) * pageSize, safePage * pageSize),
      total: rows.length,
      page: safePage,
      pageSize,
      totalPages,
      totals,
      states: Array.from(new Set(schools.map(s => s.state).filter((s): s is string => !!s))).sort(),
    });
  } catch (error: any) {
    console.error('GET result/overview/schools failed:', error);
    return NextResponse.json({ message: 'Failed to fetch schools', error: error?.message }, { status: 500 });
  }
}
