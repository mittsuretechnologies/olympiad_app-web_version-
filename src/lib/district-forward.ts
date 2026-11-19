import { prisma } from '@/lib/prisma';
import { getResultOverview, type ExamSource } from '@/lib/result-overview';
import type { KoshKey } from '@/lib/kosh';

// Level 1 → Level 2: in EACH district, the top DISTRICT_TOP_N distinct holistic
// percentages, and everyone sitting on one of them (ties share a rank, so a
// district can send more than ten; one with fewer complete results sends all).
export const DISTRICT_TOP_N = 10;

/** Grouping key for a district / state name, so "Jaipur", "jaipur " and "JAIPUR" are one. */
export const areaKey = (s: string | null | undefined) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

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
  rank: number; // 1 = the district's highest distinct percentage
  /** Stage-1 final % of each kosha (exam + both videos), saved when forwarded. */
  koshPercents: Partial<Record<KoshKey, number>>;
}

export interface DistrictPool {
  /** areaKey(state) + '|' + areaKey(district) */
  key: string;
  district: string;
  state: string | null;
  /** Students in this district with a rankable result. */
  eligible: number;
  /** The district's top DISTRICT_TOP_N distinct holistic %s, highest first. */
  topPercents: number[];
  students: RankedStudent[];
}

// Ranks every district separately, on the result the Result page shows for the
// chosen exam marks (its Manual / AI toggle). Only rankable results count:
// both videos' marks published AND the exam done (result-overview's
// rankEligible). Students left out are counted, not hidden.
export async function rankForDistrict(examSource: ExamSource = 'manual') {
  const overview = await getResultOverview('', examSource);
  const rows = overview?.rows ?? [];

  let waitingForExam = 0; // videos done, exam not scanned / not fully reviewed
  let noDistrict = 0;     // rankable, but their school has no district set
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.olympiadCode || r.olympiadCode === '-') continue;
    if (r.status !== 'Complete' || r.holisticPercent === null) continue;
    if (!r.rankEligible) { waitingForExam++; continue; }
    const district = areaKey(r.district);
    if (!district) { noDistrict++; continue; }
    const key = `${areaKey(r.state)}|${district}`;
    (groups.get(key) || groups.set(key, []).get(key)!).push(r);
  }

  const toRanked = (r: (typeof rows)[number], rank: number): RankedStudent => ({
    studentKey: r.studentKey,
    name: r.name,
    olympiadCode: r.olympiadCode,
    className: r.className,
    schoolName: r.schoolName,
    schoolCode: r.schoolId,
    state: r.state?.trim() || null,
    district: r.district?.trim() || null,
    holisticPercent: r.holisticPercent as number,
    rank,
    koshPercents: Object.fromEntries(
      r.koshBreakdown.filter(k => k.combinedPercent !== null).map(k => [k.kosh, k.combinedPercent as number]),
    ),
  });

  const districts: DistrictPool[] = [];
  for (const [key, list] of groups) {
    const topPercents = Array.from(new Set(list.map(r => r.holisticPercent as number)))
      .sort((a, b) => b - a)
      .slice(0, DISTRICT_TOP_N);
    const rankOf = new Map(topPercents.map((p, i) => [p, i + 1]));
    const students = list
      .filter(r => rankOf.has(r.holisticPercent as number))
      .map(r => toRanked(r, rankOf.get(r.holisticPercent as number)!))
      .sort((a, b) => a.rank - b.rank || (a.schoolName || '').localeCompare(b.schoolName || '') || a.name.localeCompare(b.name));
    districts.push({
      key,
      district: list[0].district!.trim(),
      state: list[0].state?.trim() || null,
      eligible: list.length,
      topPercents,
      students,
    });
  }
  districts.sort((a, b) => (a.state || '').localeCompare(b.state || '') || a.district.localeCompare(b.district));

  const qualifying = districts.flatMap(d => d.students);
  const byCode = new Map(rows.map(r => [r.olympiadCode, r]));
  return { districts, qualifying, byCode, waitingForExam, noDistrict };
}

// School.schoolId ("MITT014") -> School.id, which DistrictForward points at.
export async function schoolIdsByCode() {
  const schools = await prisma.school.findMany({ select: { id: true, schoolId: true } });
  return new Map(schools.map(s => [s.schoolId, s.id]));
}
