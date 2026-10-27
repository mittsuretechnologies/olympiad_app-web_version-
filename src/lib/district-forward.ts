import { prisma } from '@/lib/prisma';
import { getResultOverview } from '@/lib/result-overview';

// How many distinct holistic percentages count as "top" when picking students
// to forward to the district level.
export const DISTRICT_TOP_N = 10;

export interface RankedStudent {
  studentKey: string;
  name: string;
  olympiadCode: string;
  className: string | null;
  schoolName: string | null;
  schoolCode: string | null; // School.schoolId ("MITT014"), not the row id
  state: string | null;
  district: string | null;
  holisticPercent: number;
  rank: number; // 1 = highest distinct percentage
}

// The district-level pool: across ALL schools together, every student with a
// complete result (exam + both videos), take the top DISTRICT_TOP_N distinct
// holistic percentages; everyone sitting on one of those percentages qualifies,
// so ties can make it more than ten students. Uses the same numbers as the
// Result page (reviewer's exam marks), so what the passport shows is what ranks.
export async function rankForDistrict() {
  const overview = await getResultOverview('', 'manual');
  const rows = overview?.rows ?? [];

  const eligible = rows.filter(r =>
    r.status === 'Complete' && r.holisticPercent !== null && r.olympiadCode && r.olympiadCode !== '-');

  const topPercents = Array.from(new Set(eligible.map(r => r.holisticPercent as number)))
    .sort((a, b) => b - a)
    .slice(0, DISTRICT_TOP_N);
  const rankOf = new Map(topPercents.map((p, i) => [p, i + 1]));

  const toRanked = (r: (typeof rows)[number], rank: number): RankedStudent => ({
    studentKey: r.studentKey,
    name: r.name,
    olympiadCode: r.olympiadCode,
    className: r.className,
    schoolName: r.schoolName,
    schoolCode: r.schoolId,
    state: r.state,
    district: r.district,
    holisticPercent: r.holisticPercent as number,
    rank,
  });

  const qualifying = eligible
    .filter(r => rankOf.has(r.holisticPercent as number))
    .map(r => toRanked(r, rankOf.get(r.holisticPercent as number)!))
    .sort((a, b) => a.rank - b.rank || (a.state || '').localeCompare(b.state || '')
      || (a.district || '').localeCompare(b.district || '') || (a.schoolName || '').localeCompare(b.schoolName || '')
      || a.name.localeCompare(b.name));

  const byCode = new Map(rows.map(r => [r.olympiadCode, r]));
  return { topPercents, qualifying, byCode };
}

// School.schoolId ("MITT014") -> School.id, which DistrictForward points at.
export async function schoolIdsByCode() {
  const schools = await prisma.school.findMany({ select: { id: true, schoolId: true } });
  return new Map(schools.map(s => [s.schoolId, s.id]));
}
