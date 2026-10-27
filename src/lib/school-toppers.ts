import { getResultOverview } from '@/lib/result-overview';

// How many distinct holistic percentages count as a school's "top" marks.
export const SCHOOL_TOP_N = 3;

export interface TopperStudent {
  name: string;
  olympiadCode: string;
  className: string | null;
}

export interface TopperTier {
  rank: number; // 1 = the school's highest distinct percentage
  holisticPercent: number;
  students: TopperStudent[];
}

export interface SchoolToppers {
  schoolCode: string;
  schoolName: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  completeStudents: number;
  tiers: TopperTier[];
}

// Per school: of its students with a complete result (exam + both videos), the
// top SCHOOL_TOP_N distinct holistic percentages and everyone on each of them,
// so a tie puts several students on one tier. Same numbers as the Result page
// (reviewer's exam marks), so the passport and this list always agree.
export async function topPerSchool(): Promise<SchoolToppers[]> {
  const overview = await getResultOverview('', 'manual');
  const rows = overview?.rows ?? [];

  const bySchool = new Map<string, typeof rows>();
  for (const r of rows) {
    if (r.status !== 'Complete' || r.holisticPercent === null || !r.schoolId) continue;
    (bySchool.get(r.schoolId) || bySchool.set(r.schoolId, []).get(r.schoolId)!).push(r);
  }

  const out: SchoolToppers[] = [];
  for (const [schoolCode, list] of bySchool) {
    const percents = Array.from(new Set(list.map(r => r.holisticPercent as number)))
      .sort((a, b) => b - a)
      .slice(0, SCHOOL_TOP_N);
    const tiers: TopperTier[] = percents.map((p, i) => ({
      rank: i + 1,
      holisticPercent: p,
      students: list
        .filter(r => r.holisticPercent === p)
        .map(r => ({ name: r.name, olympiadCode: r.olympiadCode, className: r.className }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
    const first = list[0];
    out.push({
      schoolCode, schoolName: first.schoolName, city: first.city, district: first.district, state: first.state,
      completeStudents: list.length, tiers,
    });
  }
  return out.sort((a, b) => (a.state || '').localeCompare(b.state || '')
    || (a.district || '').localeCompare(b.district || '') || (a.schoolName || '').localeCompare(b.schoolName || ''));
}
