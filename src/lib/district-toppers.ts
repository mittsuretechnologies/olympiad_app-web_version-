import { getResultOverview } from '@/lib/result-overview';
import type { TopperTier } from '@/lib/school-toppers';

// How many distinct holistic percentages count as a district's "toppers".
export const DISTRICT_TOP_N = 3;

export interface DistrictToppers {
  district: string;
  state: string | null;
  completeStudents: number;
  tiers: (Omit<TopperTier, 'students'> & {
    students: { name: string; olympiadCode: string; className: string | null; schoolName: string | null; schoolCode: string | null }[];
  })[];
}

// Per district: of its students with a complete result (exam + both videos),
// the top DISTRICT_TOP_N distinct holistic percentages and everyone on each,
// so a tie puts several students on one tier. Ranked on holistic percentage
// only, never on exam score. Same numbers as the Result page (reviewer's exam
// marks). Students whose school has no district set are left out.
export async function topPerDistrict(): Promise<DistrictToppers[]> {
  const overview = await getResultOverview('', 'manual');
  const rows = overview?.rows ?? [];

  // Keyed by state + district, so same-named districts in two states stay apart.
  const byDistrict = new Map<string, typeof rows>();
  for (const r of rows) {
    const district = r.district?.trim();
    if (r.status !== 'Complete' || r.holisticPercent === null || !district) continue;
    const key = `${r.state?.trim() || ''}|${district}`;
    (byDistrict.get(key) || byDistrict.set(key, []).get(key)!).push(r);
  }

  const out: DistrictToppers[] = [];
  for (const list of byDistrict.values()) {
    const district = list[0].district!.trim();
    const percents = Array.from(new Set(list.map(r => r.holisticPercent as number)))
      .sort((a, b) => b - a)
      .slice(0, DISTRICT_TOP_N);
    out.push({
      district,
      state: list[0].state,
      completeStudents: list.length,
      tiers: percents.map((p, i) => ({
        rank: i + 1,
        holisticPercent: p,
        students: list
          .filter(r => r.holisticPercent === p)
          .map(r => ({ name: r.name, olympiadCode: r.olympiadCode, className: r.className, schoolName: r.schoolName, schoolCode: r.schoolId }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
    });
  }
  return out.sort((a, b) => (a.state || '').localeCompare(b.state || '') || a.district.localeCompare(b.district));
}
