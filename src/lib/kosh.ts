// Panchkosh evaluation model: each student submits 2 videos, each scored
// once (4 criteria, out of 20 marks total). That single score is recorded
// under both koshas assigned to the video's slot, but each kosh's actual
// CONTRIBUTION toward the final 4-kosh 100% is half the video's % — e.g. a
// video scoring 80% gives 40% to each of its two koshas. Summing all 4
// koshas' contributions (2 per video, 2 videos) yields the final 0-100%.
export const KOSH_MAX_SCORE = 20;

export const KOSHAS_BY_VIDEO_SLOT = [
  ['ANNAMAYA', 'PRANAMAYA'],
  ['VIJNANAMAYA', 'ANANDAMAYA'],
] as const;

export type KoshKey = typeof KOSHAS_BY_VIDEO_SLOT[number][number];

export const KOSH_LABELS: Record<KoshKey, string> = {
  ANNAMAYA: 'Annamaya Kosh',
  PRANAMAYA: 'Pranamaya Kosh',
  VIJNANAMAYA: 'Vijnanamaya Kosh',
  ANANDAMAYA: 'Anandamaya Kosh',
};

export function koshesForSlot(slot: number): readonly [KoshKey, KoshKey] {
  return KOSHAS_BY_VIDEO_SLOT[slot] ?? KOSHAS_BY_VIDEO_SLOT[KOSHAS_BY_VIDEO_SLOT.length - 1];
}

// A student's videos are ordered by createdAt ascending to determine which
// video is "video 1" (slot 0) vs "video 2" (slot 1), matching the order
// already used to label videos elsewhere in the evaluator UI.
export function videoSlot(videoCreatedAt: Date | string, allStudentVideoCreatedAts: (Date | string)[]): number {
  const sorted = [...allStudentVideoCreatedAts].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return sorted.findIndex(d => new Date(d).getTime() === new Date(videoCreatedAt).getTime());
}

// A video's own percentage (0-100), from its single 0-20 total score.
export function videoPercent(totalScore: number): number {
  return Math.round((totalScore / KOSH_MAX_SCORE) * 1000) / 10;
}

// What one kosh contributes toward the final 4-kosh 100% — half of the
// video's own %, since each video's score is split evenly across its 2 koshas.
export function koshContribution(videoPct: number): number {
  return Math.round((videoPct / 2) * 10) / 10;
}

// A video's % derived from its (duplicate) kosh rows. Returns null if either
// expected kosh is not yet scored (video is incomplete).
export function videoPercentFromKoshes(scores: { kosh: string | null; totalScore: number }[], expectedKoshes: readonly [string, string]): number | null {
  const byKosh = new Map(scores.map(s => [s.kosh, s.totalScore]));
  if (!expectedKoshes.every(k => byKosh.has(k))) return null;
  // Both koshas hold the same totalScore (one scoring form per video), so
  // either one gives the video's %.
  return videoPercent(byKosh.get(expectedKoshes[0])!);
}

// The scanner (exam) app scores against the classical 5 koshas, not just the
// 4 this app's video evaluation covers. Manomaya only ever has an exam-side
// number — there is no video-evaluation counterpart for it.
export const MANOMAYA = 'MANOMAYA' as const;
export type AnyKoshKey = KoshKey | typeof MANOMAYA;

export const ALL_KOSH_LABELS: Record<AnyKoshKey, string> = {
  ...KOSH_LABELS,
  MANOMAYA: 'Manomaya Kosh',
};

// scanner.sheet_results.score_breakdown.per_kosha keys are capitalized
// ("Annamaya", "Pranamaya", ...) — this app's enum values are upper-cased
// ("ANNAMAYA"). Normalize so both sides can be looked up the same way.
export function normalizeKoshKey(raw: string): AnyKoshKey | null {
  const upper = raw.toUpperCase();
  if (upper === 'ANNAMAYA' || upper === 'PRANAMAYA' || upper === 'MANOMAYA' || upper === 'VIJNANAMAYA' || upper === 'ANANDAMAYA') {
    return upper as AnyKoshKey;
  }
  return null;
}

// Holistic Progress Passport: each kosh's final % is the average of its
// exam-side % (from the scanner) and its video-side % (from this app's
// evaluators), when both exist. If only one side has a number for a given
// kosh (e.g. Manomaya has no video counterpart, or a video hasn't been
// scored yet), that side's number is used as-is rather than treated as 0.
export function combineKoshPercent(examPct: number | null, videoPct: number | null): number | null {
  if (examPct === null && videoPct === null) return null;
  if (examPct === null) return Math.round(videoPct! * 10) / 10;
  if (videoPct === null) return Math.round(examPct * 10) / 10;
  return Math.round(((examPct + videoPct) / 2) * 10) / 10;
}
