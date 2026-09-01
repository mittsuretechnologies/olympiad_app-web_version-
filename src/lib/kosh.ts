// Panchkosh Talent Round evaluation model: each student submits 2 videos.
// Every video is scored on 5 criteria (0-4 marks each, 20 total), and each
// criterion is mapped 1:1 to one of the 5 koshas:
//   Coordination            → Annamaya
//   Memory and Energy       → Pranamaya
//   Imagination and Emotion → Manomaya
//   Focus / Language        → Vijnanamaya ("Focus" on video 1, "Language" on video 2)
//   Creativity and Joyfulness → Anandamaya
// A student's per-kosha score is the SUM of that kosha's criterion from both
// videos (max 4 + 4 = 8), graded Beginner (1-4) / Progressing (4.1-6) /
// Proficient (6.1-8). Each kosha is its own complete 100% — video 1's
// criterion is 50% of it and video 2's the other 50%.

export const MAX_PER_CRITERION = 4;
export const CRITERIA_COUNT = 5;
export const VIDEO_MAX_SCORE = MAX_PER_CRITERION * CRITERIA_COUNT; // 20
export const REQUIRED_VIDEOS = 2;
export const KOSH_MAX_SCORE = MAX_PER_CRITERION * REQUIRED_VIDEOS; // 8

export const KOSH_KEYS = ['ANNAMAYA', 'PRANAMAYA', 'MANOMAYA', 'VIJNANAMAYA', 'ANANDAMAYA'] as const;
export type KoshKey = typeof KOSH_KEYS[number];
// Kept for callers that predate Manomaya joining the video side.
export type AnyKoshKey = KoshKey;

export const KOSH_LABELS: Record<KoshKey, string> = {
  ANNAMAYA: 'Annamaya Kosh',
  PRANAMAYA: 'Pranamaya Kosh',
  MANOMAYA: 'Manomaya Kosh',
  VIJNANAMAYA: 'Vijnanamaya Kosh',
  ANANDAMAYA: 'Anandamaya Kosh',
};
export const ALL_KOSH_LABELS = KOSH_LABELS;

export type CriterionKey =
  | 'coordinationScore'
  | 'memoryEnergyScore'
  | 'imaginationEmotionScore'
  | 'focusLanguageScore'
  | 'creativityJoyScore';

// A per-level rubric: index 0..4 describes what each 0-4 mark looks like, so
// two evaluators reading the same descriptor land on the same score. Where a
// criterion means different things across the two videos (focus vs language),
// `rubricBySlot` overrides `rubric` for that slot.
export type Rubric = [string, string, string, string, string];

interface KoshCriterion {
  key: CriterionKey;
  kosh: KoshKey;
  labelBySlot: [string, string];
  // What the evaluator is looking for, one line, shown under the label.
  hint: string;
  // Level descriptors 0→4 (0 = not shown / absent, 4 = exemplary).
  rubric: Rubric;
  // Optional per-video overrides, e.g. video 1 = Focus, video 2 = Language.
  rubricBySlot?: [Rubric, Rubric];
}

// Ordered as on the Talent Round sheet. focusLanguageScore is labeled
// "Focus" for video 1 (slot 0) and "Language" for video 2 (slot 1).
export const KOSH_CRITERIA: KoshCriterion[] = [
  {
    key: 'coordinationScore', kosh: 'ANNAMAYA', labelBySlot: ['Coordination', 'Coordination'],
    hint: 'Body control, rhythm, and physical steadiness while performing.',
    rubric: [
      'Not observable / no attempt',
      'Stiff or off-beat; loses balance often',
      'Some control; timing wavers in parts',
      'Mostly smooth, steady movement and rhythm',
      'Fluid, fully controlled, on-beat throughout',
    ],
  },
  {
    key: 'memoryEnergyScore', kosh: 'PRANAMAYA', labelBySlot: ['Memory and Energy', 'Memory and Energy'],
    hint: 'Recall of the material and the liveliness/stamina brought to it.',
    rubric: [
      'Not observable / no attempt',
      'Forgets often; low energy, flat delivery',
      'Recalls with prompts; energy dips midway',
      'Recalls well; good energy most of the way',
      'Effortless recall; vibrant energy start to finish',
    ],
  },
  {
    key: 'imaginationEmotionScore', kosh: 'MANOMAYA', labelBySlot: ['Imagination and Emotion', 'Imagination and Emotion'],
    hint: 'Expressiveness, feeling, and imaginative interpretation.',
    rubric: [
      'Not observable / no attempt',
      'Mechanical; little feeling or expression',
      'Some expression; emotion inconsistent',
      'Expressive and engaged for most of it',
      'Richly expressive; imaginative, felt throughout',
    ],
  },
  {
    key: 'focusLanguageScore', kosh: 'VIJNANAMAYA', labelBySlot: ['Focus', 'Language'],
    hint: 'Video 1: attention & concentration. Video 2: clarity of language.',
    // Placeholder (never used directly — rubricBySlot always overrides).
    rubric: ['—', '—', '—', '—', '—'],
    rubricBySlot: [
      [ // Focus (video 1)
        'Not observable / no attempt',
        'Easily distracted; loses track',
        'Focus comes and goes',
        'Stays focused for most of the performance',
        'Fully absorbed; unbroken concentration',
      ],
      [ // Language (video 2)
        'Not observable / no attempt',
        'Unclear words; hard to follow',
        'Understandable but hesitant or limited',
        'Clear, correct language most of the time',
        'Fluent, articulate, and confident language',
      ],
    ],
  },
  {
    key: 'creativityJoyScore', kosh: 'ANANDAMAYA', labelBySlot: ['Creativity and Joyfulness', 'Creativity and Joyfulness'],
    hint: 'Originality, spontaneity, and visible joy/confidence in performing.',
    rubric: [
      'Not observable / no attempt',
      'Rote and joyless; hesitant',
      'A few original or joyful moments',
      'Creative and clearly enjoying it',
      'Highly original; radiates joy and confidence',
    ],
  },
];

// The rubric that applies to a criterion for a given video slot.
export function criterionRubric(c: KoshCriterion, slot: number): Rubric {
  if (c.rubricBySlot) return c.rubricBySlot[Math.min(Math.max(slot, 0), 1)];
  return c.rubric;
}

export const CRITERION_KEYS = KOSH_CRITERIA.map(c => c.key) as CriterionKey[];

export function criterionLabel(key: CriterionKey, slot: number): string {
  const c = KOSH_CRITERIA.find(c => c.key === key)!;
  return c.labelBySlot[Math.min(Math.max(slot, 0), 1)];
}

export type CriterionScores = Record<CriterionKey, number>;

// A student's videos are ordered by createdAt ascending to determine which
// video is "video 1" (slot 0) vs "video 2" (slot 1), matching the order
// already used to label videos elsewhere in the evaluator UI.
export function videoSlot(videoCreatedAt: Date | string, allStudentVideoCreatedAts: (Date | string)[]): number {
  const sorted = [...allStudentVideoCreatedAts].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return sorted.findIndex(d => new Date(d).getTime() === new Date(videoCreatedAt).getTime());
}

// A video's own percentage (0-100), from its 0-20 total score.
export function videoPercent(totalScore: number): number {
  return Math.round((totalScore / VIDEO_MAX_SCORE) * 1000) / 10;
}

// Grading bands applied to the per-kosha sum of both videos (0-8 scale).
export type KoshGrade = 'Beginner' | 'Progressing' | 'Proficient';

export function koshGrade(koshScore: number): KoshGrade {
  if (koshScore <= 4) return 'Beginner';
  if (koshScore <= 6) return 'Progressing';
  return 'Proficient';
}

// Per-kosha score for a student = sum of the kosha's criterion across their
// videos (max 8 with both videos scored). Returns per-kosha totals plus how
// many videos contributed, so callers can tell partial from complete.
export function koshScoresFromVideos(videos: (CriterionScores | null | undefined)[]): {
  scores: Record<KoshKey, number>;
  scoredVideos: number;
} {
  const scores = Object.fromEntries(KOSH_KEYS.map(k => [k, 0])) as Record<KoshKey, number>;
  let scoredVideos = 0;
  for (const v of videos) {
    if (!v) continue;
    scoredVideos++;
    for (const c of KOSH_CRITERIA) scores[c.kosh] += v[c.key] ?? 0;
  }
  return { scores, scoredVideos };
}

// Each kosha is its own complete 100%: video 1's criterion contributes 50%
// and video 2's the other 50% — i.e. the average of both videos' 0-4 scores,
// expressed as a %. With only one video scored so far, that video's criterion
// % stands alone (not halved), mirroring how exam/video sides combine.
export function koshPercent(koshScore: number, scoredVideos: number): number | null {
  if (scoredVideos <= 0) return null;
  const max = MAX_PER_CRITERION * Math.min(scoredVideos, REQUIRED_VIDEOS);
  return Math.round((koshScore / max) * 1000) / 10;
}

// scanner.sheet_results.score_breakdown.per_kosha keys are capitalized
// ("Annamaya", "Pranamaya", ...) — this app's enum values are upper-cased
// ("ANNAMAYA"). Normalize so both sides can be looked up the same way.
export function normalizeKoshKey(raw: string): KoshKey | null {
  const upper = raw.toUpperCase();
  return (KOSH_KEYS as readonly string[]).includes(upper) ? (upper as KoshKey) : null;
}

// Holistic Progress Passport: each kosh's final % is the average of its
// exam-side % (from the scanner) and its video-side % (from this app's
// evaluators). A round the student hasn't done yet counts as 0 in that
// average, not as "not applicable" — otherwise a student who only sat one
// round would outscore one who did both but scored moderately on each,
// which rewards skipping a round rather than doing it. Only when NEITHER
// round exists yet is there truly nothing to score.
export function combineKoshPercent(examPct: number | null, videoPct: number | null): number | null {
  if (examPct === null && videoPct === null) return null;
  return Math.round((((examPct ?? 0) + (videoPct ?? 0)) / 2) * 10) / 10;
}
