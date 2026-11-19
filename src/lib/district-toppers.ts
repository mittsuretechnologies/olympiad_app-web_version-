import { rankForDistrict, DISTRICT_TOP_N } from '@/lib/district-forward';
import type { TopperTier } from '@/lib/school-toppers';

// The same top-N as State Level forwarding, so this list and who goes to
// Level 2 never disagree.
export { DISTRICT_TOP_N };

export interface DistrictToppers {
  district: string;
  state: string | null;
  completeStudents: number;
  tiers: (Omit<TopperTier, 'students'> & {
    students: { name: string; olympiadCode: string; className: string | null; schoolName: string | null; schoolCode: string | null }[];
  })[];
}

// Per district: the top DISTRICT_TOP_N distinct holistic percentages and
// everyone on each (ties share a tier), from the very ranking State Level
// forwarding uses (lib/district-forward.ts, reviewer's exam marks). Students
// whose school has no district set are left out.
export async function topPerDistrict(): Promise<DistrictToppers[]> {
  const { districts } = await rankForDistrict('manual');
  return districts.map(d => ({
    district: d.district,
    state: d.state,
    completeStudents: d.eligible,
    tiers: d.topPercents.map((p, i) => ({
      rank: i + 1,
      holisticPercent: p,
      students: d.students
        .filter(s => s.rank === i + 1)
        .map(s => ({ name: s.name, olympiadCode: s.olympiadCode, className: s.className, schoolName: s.schoolName, schoolCode: s.schoolCode }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),
  }));
}
