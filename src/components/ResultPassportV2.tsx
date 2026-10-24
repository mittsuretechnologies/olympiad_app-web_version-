'use client';

// Holistic Progress Passport — a page-for-page replica of the designer's
// "Junior Power Quest" passport PDF. Each page is the PDF's own artwork
// (rendered and cleaned by scripts/build-passport-assets.py into
// public/passport/) with the student's real data laid on top at the PDF's
// coordinates. Everything inside a page is positioned in PDF points
// (372.33 × 528.24); the page is then scaled to fit the screen.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import type { CriterionKey } from '@/lib/kosh';
import geometry from '@/components/passport/geometry.json';
import { roboto, robotoCondensed } from '@/components/passport/fonts';

/* ── Data shapes (mirrors /api/result/overview) ─────────────── */

interface PassportExamQuestion {
  questionNumber: number;
  pageNumber: number;
  questionText: string | null;
  questionType: string | null;
  maxMarks: number;
  score: number | null;
  percentage: number | null;
  // Scanner's own band for the question ("Proficient", "Did not attempt", …),
  // AI and reviewer versions — the reviewer's wins when present.
  performanceLevel?: string | null;
  manualPerformanceLevel?: string | null;
  aiKoshas: { kosha: string; earned: number; weight: number }[];
  manualKoshas: { kosha: string; earned: number; weight: number }[];
}

interface PassportVideo {
  id: string;
  category: string | null;
  subCategory: string | null;
  slot: number;
  criteria: Record<CriterionKey, number> | null;
  totalScore: number | null;
  isPublished: boolean;
  videoPercent: number | null;
  evaluatorName: string | null;
}

interface PassportKosh {
  kosh: string;
  label: string;
  videoScore: number | null;
  videoMaxScore: number;
  grade: 'Beginner' | 'Progressing' | 'Proficient' | null;
  examPercent: number | null;
  videoPercent: number | null;
  combinedPercent: number | null;
}

export interface PassportV2Student {
  studentKey: string;
  name: string;
  olympiadCode: string;
  className: string | null;
  schoolName: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  /** The school's exam date (ISO), shown as the passport's assessment date. */
  examDate?: string | null;
  avatarUrl: string | null;
  videos: PassportVideo[];
  examPercentage: number | null;
  examQuestions: PassportExamQuestion[];
  videoScoreTotal: number;
  videoMaxScore: number;
  koshBreakdown: PassportKosh[];
  holisticPercent: number | null;
  status: 'Complete' | 'Incomplete';
}

/* ── Levels ─────────────────────────────────────────────────── */

type Grade = 'Beginner' | 'Progressing' | 'Proficient';
type Badge = 'proficient' | 'progressing' | 'beginner' | 'not-attempted';

function bandFromPercent(pct: number): Grade {
  if (pct >= 70) return 'Proficient';
  if (pct >= 40) return 'Progressing';
  return 'Beginner';
}

function badgeOf(grade: Grade | null): Badge | null {
  return grade ? (grade.toLowerCase() as Badge) : null;
}

function questionBadge(q: PassportExamQuestion): Badge | null {
  const raw = (q.manualPerformanceLevel ?? q.performanceLevel ?? '').toLowerCase();
  if (raw.includes('attempt')) return 'not-attempted';
  if (raw.includes('proficient')) return 'proficient';
  if (raw.includes('progress')) return 'progressing';
  if (raw.includes('beginner')) return 'beginner';
  return q.percentage !== null ? badgeOf(bandFromPercent(q.percentage)) : null;
}

// Puzzle colour per level, as explained on the summary page's legend.
const PUZZLE_FAMILY: Record<Grade, 'orange' | 'blue' | 'green'> = {
  Beginner: 'orange', Progressing: 'blue', Proficient: 'green',
};

const LEVEL_LINE: Record<Grade, string> = {
  Beginner: 'You are an Explorer!',
  Progressing: 'You are a Learner!',
  Proficient: 'You are a Champion!',
};

function remarks(first: string, level: Grade | null): string {
  switch (level) {
    case 'Proficient':
      return `${first} shows excellent enthusiasm and confidence during the talent round. Demonstrates skills beyond age-appropriate expectations with joyful, consistent participation. With continued encouragement, ${first} will keep shining across every dimension.`;
    case 'Progressing':
      return `${first} shows good enthusiasm and confidence during the talent round. Demonstrates age-appropriate skills with consistent participation. Continues to make steady progress and, with regular practice and encouragement, will achieve greater confidence and proficiency.`;
    case 'Beginner':
      return `${first} participated with interest during the talent round and is beginning to build age-appropriate skills. With regular practice, gentle guidance and encouragement at home and school, ${first} will grow in confidence and proficiency.`;
    default:
      return `${first}'s talent round evaluation is in progress. Remarks will appear here once both videos have been evaluated.`;
  }
}

// question_type is a code (e.g. "circle_correct"); used only for older scans
// that predate scanner.questions' instruction text.
const QUESTION_TYPE_LABELS: Record<string, string> = {
  trace_dotted_bands: 'Trace the dotted lines.',
  circle_correct: 'Circle the correct answer.',
  color_image: 'Colour the picture.',
  color_by_rule: 'Colour as indicated.',
  color_correct_picture: 'Identify and colour the correct picture.',
  missing_letter: 'Fill in the missing letter.',
};

function questionLabel(text: string | null, type: string | null, num: number): string {
  if (text) return text;
  if (!type) return `Question ${num}.`;
  if (QUESTION_TYPE_LABELS[type]) return QUESTION_TYPE_LABELS[type];
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + '.';
}

// NEP stage for the class, as the PDF prints "Nursery/Foundational Stage".
function developmentStage(cls: string | null): string | null {
  if (!cls) return null;
  if (/nursery|kg|lkg|ukg|pre|play/i.test(cls)) return `${cls}/Foundational Stage`;
  const n = Number(cls.match(/\d+/)?.[0]);
  if (!n) return cls;
  const stage = n <= 2 ? 'Foundational' : n <= 5 ? 'Preparatory' : n <= 8 ? 'Middle' : 'Secondary';
  return `${cls}/${stage} Stage`;
}

const formatAssessmentDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : null;

const BATCH = 'Junior Power Quest 2026';
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/* ── Page canvas & text primitives (all units = PDF points) ─── */

const PW = geometry.page.w;
const PH = geometry.page.h;
const INK = '#2B2A29';
const NAVY = '#2D2556';
const CREAM = '#F7EBD1';
const COND = robotoCondensed.style.fontFamily;
// With line-height 1, Roboto's baseline sits 0.842em below the box top.
const BASELINE = 0.842;

function Canvas({ bg, children }: { bg: string; children?: React.ReactNode }) {
  return (
    <div className="absolute left-0 top-0 origin-top-left overflow-hidden" style={{ width: PW, height: PH, transform: 'scale(var(--pp-scale))' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/passport/${bg}.webp`} alt="" draggable={false} className="absolute inset-0 w-full h-full select-none" />
      {children}
    </div>
  );
}

function Img({ src, x, y, w, h, style }: { src: string; x: number; y: number; w: number; h: number; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/passport/${src}.webp`} alt="" draggable={false} className="absolute select-none" style={{ left: x, top: y, width: w, height: h, ...style }} />;
}

// Single line of text placed by its baseline; shrinks to fit `max` width.
function Txt({ x, y, size, children, align = 'left', max, family, weight = 400, italic, color = INK, spacing }: {
  x: number; y: number; size: number; children: React.ReactNode; align?: 'left' | 'center' | 'right';
  max?: number; family?: string; weight?: number; italic?: boolean; color?: string; spacing?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(size);
  useLayoutEffect(() => {
    setFit(size);
  }, [size, children]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !max) return;
    if (el.scrollWidth > max + 0.5) setFit(f => Math.max(f * (max / el.scrollWidth), size * 0.6));
  }, [fit, max, size, children]);
  const left = align === 'left' ? x : align === 'center' ? x : undefined;
  return (
    <div ref={ref} className="absolute whitespace-nowrap" style={{
      left, right: align === 'right' ? PW - x : undefined,
      top: y - BASELINE * fit, fontSize: fit, lineHeight: 1,
      transform: align === 'center' ? 'translateX(-50%)' : undefined,
      fontFamily: family, fontWeight: weight, fontStyle: italic ? 'italic' : undefined,
      color, letterSpacing: spacing,
    }}>
      {children}
    </div>
  );
}

function PageNo({ n }: { n: number }) {
  return <Txt x={186.1} y={503.5} size={11.6} align="center" color={NAVY}>{n}</Txt>;
}

/* ── Pages ──────────────────────────────────────────────────── */

// p02 artwork is 1118px wide; the Age row sits 117px between the Name and
// Development Stage dividers, which is how far the lower rows move up.
const K = PW / 1118;
const AGE_ROW_SHIFT = 117 * K;

function IdCardPage({ s }: { s: PassportV2Student }) {
  const values: [number, string][] = [
    [165.5, s.name.toUpperCase()],
    [242.25, developmentStage(s.className) || '—'],
    [282.5, s.schoolName || '—'],
    [324.25, s.olympiadCode],
    [363.75, BATCH],
    [402.75, formatAssessmentDate(s.examDate) || '—'],
  ];
  const initials = s.name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <Canvas bg="p02">
      <div className="absolute overflow-hidden flex items-center justify-center" style={{
        left: 33.75, top: 142.25, width: 99.5, height: 127.5, borderRadius: 7.5,
        border: '0.75px solid #D7B56D', background: s.avatarUrl ? '#fff' : '#EFE0BE',
      }}>
        {s.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.avatarUrl} alt={s.name} className="w-full h-full object-cover" />
        ) : (
          <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 34, color: NAVY, opacity: 0.55 }}>{initials}</span>
        )}
      </div>
      {/* The Age row is baked into the page artwork: blank it and its follow-on rows,
          then redraw those rows from the artwork shifted up into the gap. */}
      <div className="absolute" style={{ left: 470 * K, top: 522 * K, width: 470 * K, height: 703 * K, background: '#F6EBD1' }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/passport/p02.webp" alt="" draggable={false} className="absolute select-none" style={{
        left: 0, top: 0, width: PW, height: PH, transform: `translateY(${-AGE_ROW_SHIFT}px)`,
        clipPath: `inset(${640 * K}px ${PW - 940 * K}px ${PH - 1225 * K}px ${470 * K}px)`,
      }} />
      {values.map(([y, v], i) => (
        <Txt key={i} x={198} y={i === 0 ? y : y - AGE_ROW_SHIFT} size={11.6} family={COND} weight={700} max={142}>{v}</Txt>
      ))}
    </Canvas>
  );
}

function WelcomePage({ s }: { s: PassportV2Student }) {
  return (
    <Canvas bg="p03">
      <Txt x={46.5} y={160.75} size={11.6} weight={700} color="#9A8452" max={150}>Dear {firstName(s.name)},</Txt>
    </Canvas>
  );
}

const QUESTIONS_PER_PAGE = 10;

function WrittenRoundPage({ questions, part, pageNo }: { questions: PassportExamQuestion[]; part: number; pageNo: number }) {
  const { rowLines, tableLeft, tableRight } = geometry.written;
  const cell = geometry.badgeCell;
  const used = questions.length;
  return (
    <Canvas bg="p04">
      <Txt x={186.25} y={76.25} size={12.9} weight={500} align="center">PART {part}</Txt>
      {questions.map((q, i) => {
        const top = rowLines[i] + 0.75;
        const h = rowLines[i + 1] - top;
        const badge = questionBadge(q);
        return (
          <div key={q.questionNumber}>
            <div className="absolute flex items-center" style={{ left: 40, top, width: 171, height: h, fontSize: 11.8, lineHeight: '13.25px', color: INK }}>
              <span className="text-right flex-shrink-0" style={{ width: 17.25 }}>{q.questionNumber}.</span>
              <span style={{ marginLeft: 2.5, textWrap: 'balance' } as React.CSSProperties}>
                {questionLabel(q.questionText, q.questionType, q.questionNumber).replace(/^\d+\.\s*/, '')}
              </span>
            </div>
            {badge ? (
              <Img src={`badge-${badge}`} x={cell.x} y={top} w={cell.w} h={h} />
            ) : (
              <Txt x={cell.x + cell.w / 2} y={top + h / 2 + 3.5} size={10} align="center" color="#9A8452" italic>Pending</Txt>
            )}
          </div>
        );
      })}
      {used < QUESTIONS_PER_PAGE && (
        // hide the table's unused rows (the last used row's line stays as the bottom border)
        <div className="absolute" style={{ left: tableLeft - 1, top: rowLines[used] + 0.75, width: tableRight - tableLeft + 2, height: rowLines[QUESTIONS_PER_PAGE] - rowLines[used] + 1, background: CREAM }} />
      )}
      <PageNo n={pageNo} />
    </Canvas>
  );
}

// "Lights, Camera, Action!" and Binku are part of the p06 artwork and crowd the
// video lines, so redraw that artwork smaller: blank the original, then paint a
// scaled, clipped copy of the page anchored at its top-right corner.
// Numbers below are pixels of the 1118px-wide artwork, converted to points.
function BinkuSmaller() {
  const k = PW / 1118;
  const SCALE = 0.72;
  const [ax, ay] = [1078 * k, 60 * k];
  const box = (x1: number, y1: number, x2: number, y2: number, background: string) => (
    <div className="absolute" style={{ left: x1 * k, top: y1 * k, width: (x2 - x1) * k, height: (y2 - y1) * k, background }} />
  );
  const clip = [[560, 182], [850, 182], [850, 60], [1078, 60], [1078, 445], [560, 445]]
    .map(([x, y]) => `${x * k}px ${y * k}px`).join(', ');
  return (
    <>
      {box(850, 60, 1078, 445, '#F6EBD1')}
      {box(560, 182, 850, 445, '#F6EBD1')}
      {box(850, 90, 935, 178, '#9A8450')}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/passport/p06.webp" alt="" draggable={false} className="absolute select-none" style={{
        left: 0, top: 0, width: PW, height: PH,
        transformOrigin: `${ax}px ${ay}px`, transform: `translateY(${45 * k}px) scale(${SCALE})`, clipPath: `polygon(${clip})`,
      }} />
    </>
  );
}

function TalentRoundPage({ s, pageNo, level }: { s: PassportV2Student; pageNo: number; level: Grade | null }) {
  const videos = [...s.videos].sort((a, b) => a.slot - b.slot).slice(0, 2);
  const lines = geometry.talent.rowLines;
  const cell = geometry.badgeCell;
  const byKosh = new Map(s.koshBreakdown.map(k => [k.kosh, k]));
  const order = ['ANNAMAYA', 'PRANAMAYA', 'MANOMAYA', 'VIJNANAMAYA', 'ANANDAMAYA'];
  return (
    <Canvas bg="p06">
      <BinkuSmaller />
      {[0, 1].map(i => (
        <Txt key={i} x={59.5} y={i === 0 ? 94.5 : 130.5} size={12.3} weight={500} max={150}>
          Video {i + 1}: {videos[i] ? (videos[i].category || videos[i].subCategory || 'Talent Performance') : 'Not submitted'}
        </Txt>
      ))}
      {order.map((kosh, i) => {
        const badge = badgeOf(byKosh.get(kosh)?.grade ?? null);
        const top = lines[i] + 0.75;
        const h = lines[i + 1] - top;
        return badge ? <Img key={kosh} src={`badge-${badge}`} x={cell.x} y={top} w={cell.w} h={h} /> : (
          <Txt key={kosh} x={cell.x + cell.w / 2} y={top + h / 2 + 3.5} size={10} align="center" color="#9A8452" italic>Pending</Txt>
        );
      })}
      <div className="absolute text-center" style={{ left: 52, top: 389.5, width: 268, fontSize: 11.6, lineHeight: '13.3px', color: INK }}>
        <span style={{ color: NAVY, fontWeight: 500 }}>Remarks:</span> {remarks(firstName(s.name), level)}
      </div>
      <PageNo n={pageNo} />
    </Canvas>
  );
}

function starKinds(pct: number | null): ('full' | 'half' | 'empty')[] {
  const stars = pct === null ? 0 : Math.round((pct / 100) * 10) / 2;
  return [0, 1, 2, 3, 4].map(i => (stars >= i + 1 ? 'full' : stars >= i + 0.5 ? 'half' : 'empty'));
}

const KOSH_ORDER = ['ANNAMAYA', 'PRANAMAYA', 'MANOMAYA', 'VIJNANAMAYA', 'ANANDAMAYA'] as const;

function combinedGrade(k: PassportKosh | undefined): Grade | null {
  return k && k.combinedPercent !== null ? bandFromPercent(k.combinedPercent) : null;
}

function PanchakoshaProfilePage({ s, pageNo }: { s: PassportV2Student; pageNo: number }) {
  const P = geometry.profile;
  const byKosh = new Map(s.koshBreakdown.map(k => [k.kosh, k]));
  return (
    <Canvas bg="p07">
      {KOSH_ORDER.map((kosh, i) => {
        const k = byKosh.get(kosh);
        const badge = badgeOf(combinedGrade(k));
        const t = P.rowTops[i];
        const R = P.badge.r;
        return (
          <div key={kosh}>
            {starKinds(k?.combinedPercent ?? null).map((kind, j) => (
              <Img key={j} src={`star-${kind}`} x={P.starX[j] - 0.5} y={t + 46.5} w={18.5} h={18} />
            ))}
            {badge && badge !== 'not-attempted' && (
              <Img src={`round-${badge}`} x={P.badge.cx[i] - R} y={P.badge.cy[i] - R} w={2 * R} h={2 * R} />
            )}
          </div>
        );
      })}
      <PageNo n={pageNo} />
    </Canvas>
  );
}

function PanchakoshaSummaryPage({ s, pageNo, level }: { s: PassportV2Student; pageNo: number; level: Grade | null }) {
  const arcId = useId().replace(/:/g, '');
  const byKosh = new Map(s.koshBreakdown.map(k => [k.kosh, k]));
  const pieces = KOSH_ORDER.map(kosh => ({ kosh, g: geometry.puzzle[kosh], grade: combinedGrade(byKosh.get(kosh)) }))
    .sort((a, b) => a.g.z - b.g.z);
  const c = geometry.centre;
  const e = geometry.puzzle.emoji;
  const name = firstName(s.name).toUpperCase();
  const nameSize = Math.min(14.8, (14.8 * 7) / Math.max(name.length, 1));
  const rb = 31.8;
  const ob = geometry.overall.badge;
  const R = geometry.profile.badge.r * (ob.r / (geometry.profile.badge.r - 0.5));
  const badge = badgeOf(level);
  return (
    <Canvas bg="p08">
      {pieces.map(p => (
        <Img key={p.kosh} src={`puzzle-${p.kosh.toLowerCase()}-${p.grade ? PUZZLE_FAMILY[p.grade] : 'green'}`}
          x={p.g.x} y={p.g.y} w={p.g.w} h={p.g.h} style={p.grade ? undefined : { filter: 'grayscale(1)', opacity: 0.55 }} />
      ))}
      <Img src="puzzle-emoji" x={e.x} y={e.y} w={e.w} h={e.h} />
      <Img src="p08-centre" x={c.cx - c.box} y={c.cy - c.box} w={2 * c.box} h={2 * c.box} />
      <svg className="absolute left-0 top-0 pointer-events-none" width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}>
        <path id={arcId} fill="none" d={`M ${c.cx - rb} ${c.cy} A ${rb} ${rb} 0 0 0 ${c.cx + rb} ${c.cy}`} />
        <text fill="#2655A1" fontWeight={700} fontSize={nameSize} letterSpacing={0.6} style={{ fontFamily: 'inherit' }}>
          <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{name}</textPath>
        </text>
      </svg>
      {level && <Txt x={167.5} y={477.25} size={12.6} weight={700} italic align="center">{LEVEL_LINE[level]}</Txt>}
      {badge && badge !== 'not-attempted' && <Img src={`round-${badge}`} x={ob.cx - R} y={ob.cy - R} w={2 * R} h={2 * R} />}
      <PageNo n={pageNo} />
    </Canvas>
  );
}

function InsightsPage({ s, pageNo }: { s: PassportV2Student; pageNo: number }) {
  return (
    <Canvas bg="p09">
      <Txt x={185.6} y={46.5} size={17.2} family={COND} weight={700} color={NAVY} align="center" max={240}>
        {firstName(s.name).toUpperCase()}&apos;S INSIGHTS
      </Txt>
      <PageNo n={pageNo} />
    </Canvas>
  );
}

function StaticPage({ bg, pageNo }: { bg: string; pageNo?: number }) {
  return <Canvas bg={bg}>{pageNo !== undefined && <PageNo n={pageNo} />}</Canvas>;
}

/* ── The booklet ────────────────────────────────────────────── */

function usePageWidth() {
  const [w, setW] = useState(380);
  useEffect(() => {
    const calc = () => setW(Math.min(window.innerWidth * 0.92, ((window.innerHeight - 165) * PW) / PH, 520));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return w;
}

export default function ResultPassportV2({ student, onClose, initialPage = 0 }: { student: PassportV2Student; onClose: () => void; initialPage?: number }) {
  const writtenParts: PassportExamQuestion[][] = [];
  const questions = [...student.examQuestions].sort((a, b) => a.questionNumber - b.questionNumber);
  for (let i = 0; i < questions.length; i += QUESTIONS_PER_PAGE) writtenParts.push(questions.slice(i, i + QUESTIONS_PER_PAGE));

  const level = student.holisticPercent !== null ? bandFromPercent(student.holisticPercent) : null;
  const after = 4 + writtenParts.length; // page number of the talent round
  const pages: React.ReactNode[] = [
    <StaticPage key="cover" bg="p01" />,
    <IdCardPage key="id" s={student} />,
    <WelcomePage key="welcome" s={student} />,
    ...writtenParts.map((qs, i) => <WrittenRoundPage key={`written-${i}`} questions={qs} part={i + 1} pageNo={4 + i} />),
    <TalentRoundPage key="talent" s={student} pageNo={after} level={level} />,
    <PanchakoshaProfilePage key="profile" s={student} pageNo={after + 1} />,
    <PanchakoshaSummaryPage key="summary" s={student} pageNo={after + 2} level={level} />,
    <InsightsPage key="insights" s={student} pageNo={after + 3} />,
    <StaticPage key="reflection" bg="p10" pageNo={after + 4} />,
    <StaticPage key="tools" bg="p11" pageNo={after + 5} />,
    <StaticPage key="back" bg="p12" />,
  ];

  const [page, setPage] = useState(initialPage);
  // A turn in progress: `from` is the page being left, `to` the one arriving.
  const [flip, setFlip] = useState<{ from: number; to: number; dir: 'next' | 'prev' } | null>(null);
  const width = usePageWidth();

  const goTo = useCallback((to: number) => {
    if (flip || to === page || to < 0 || to >= pages.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPage(to);
      return;
    }
    setFlip({ from: page, to, dir: to > page ? 'next' : 'prev' });
    setPage(to);
  }, [flip, page, pages.length]);

  const go = useCallback((dir: 'next' | 'prev') => goTo(page + (dir === 'next' ? 1 : -1)), [goTo, page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go('next');
      else if (e.key === 'ArrowLeft') go('prev');
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Download: mount every page off-screen at 1pt = 1px, snapshot each at 3x
  // and stitch them into a PDF the same size as the printed passport.
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!exporting) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ toJpeg, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
        const root = exportRef.current;
        if (!root) return;
        await document.fonts.ready;
        await Promise.all(Array.from(root.querySelectorAll('img')).map(img => img.decode().catch(() => undefined)));
        const sheets = Array.from(root.children) as HTMLElement[];
        const fontEmbedCSS = await getFontEmbedCSS(sheets[0]);
        // If an image can't be fetched (e.g. a photo on a host without CORS),
        // html-to-image leaves its src empty and the whole page fails — draw
        // a transparent pixel there instead so the rest of the passport exports.
        const imagePlaceholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        const pdf = new jsPDF({ unit: 'pt', format: [PW, PH], orientation: 'portrait', compress: true });
        for (let i = 0; i < sheets.length; i++) {
          if (cancelled) return;
          const jpeg = await toJpeg(sheets[i], { pixelRatio: 3, quality: 0.9, fontEmbedCSS, imagePlaceholder, width: PW, height: PH, backgroundColor: '#ffffff' });
          if (i > 0) pdf.addPage([PW, PH], 'portrait');
          pdf.addImage(jpeg, 'JPEG', 0, 0, PW, PH, undefined, 'FAST');
        }
        pdf.save(`${student.name.trim().replace(/[^\w]+/g, '_') || 'Student'}_Passport.pdf`);
      } catch (err) {
        // html-to-image rejects with a bare load Event when a page snapshot fails
        const detail = err instanceof Event ? `${err.type} on ${(err.target as HTMLImageElement | null)?.src?.slice(0, 120) ?? 'unknown'}` : err;
        console.error('Passport PDF export failed:', detail);
        alert('Could not create the PDF. Please try again.');
      } finally {
        if (!cancelled) setExporting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exporting, student.name]);

  // Turning forward, the current page lifts off the spine (left edge) and
  // swings over to the left, uncovering the next page beneath it. Turning
  // back, the previous page swings in from the left and lays down on top.
  const under = flip ? (flip.dir === 'next' ? flip.to : flip.from) : page;
  const leaf = flip ? (flip.dir === 'next' ? flip.from : flip.to) : null;

  return (
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Result passport for ${student.name}`}>
      <style>{`
        @keyframes pp-leaf-out { from { transform: perspective(2200px) rotateY(0deg); } to { transform: perspective(2200px) rotateY(-180deg); } }
        @keyframes pp-leaf-in { from { transform: perspective(2200px) rotateY(-180deg); } to { transform: perspective(2200px) rotateY(0deg); } }
        @keyframes pp-shade-out { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes pp-shade-in { 0% { opacity: 1; } 100% { opacity: 0; } }
        .pp-leaf { transform-origin: left center; backface-visibility: hidden; -webkit-backface-visibility: hidden; will-change: transform; }
        .pp-leaf-out { animation: pp-leaf-out 750ms cubic-bezier(0.45, 0.05, 0.35, 1) forwards; }
        .pp-leaf-in { animation: pp-leaf-in 750ms cubic-bezier(0.45, 0.05, 0.35, 1) forwards; }
        .pp-shade-out { animation: pp-shade-out 750ms ease-in forwards; }
        .pp-shade-in { animation: pp-shade-in 750ms ease-out forwards; }
      `}</style>

      <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        <div className={`relative ${roboto.className}`} style={{ width, height: (width * PH) / PW, ['--pp-scale' as string]: width / PW } as React.CSSProperties}>
          {/* page stack edge, so it reads as a book */}
          <div className="absolute inset-0 translate-x-[4px] translate-y-[3px] rounded-md bg-[#E9DFC9] shadow-md" aria-hidden />
          <div className="absolute inset-0 translate-x-[2px] translate-y-[1.5px] rounded-md bg-[#F3EADA]" aria-hidden />

          <div className="absolute inset-0 overflow-hidden rounded-md shadow-2xl">
            {pages[under]}
            {/* shadow the turning leaf casts on the page beneath, deepest at the spine */}
            {flip && (
              <div className={`absolute inset-0 pointer-events-none ${flip.dir === 'next' ? 'pp-shade-in' : 'pp-shade-out'}`}
                style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.38), rgba(0,0,0,0.08) 45%, transparent 75%)' }} aria-hidden />
            )}
          </div>

          {flip && leaf !== null && (
            <div key={`${flip.from}-${flip.to}`}
              className={`pp-leaf absolute inset-0 overflow-hidden rounded-md shadow-2xl ${flip.dir === 'next' ? 'pp-leaf-out' : 'pp-leaf-in'}`}
              onAnimationEnd={() => setFlip(null)}>
              {pages[leaf]}
              {/* the leaf darkens as it tilts away from the light */}
              <div className={`absolute inset-0 pointer-events-none ${flip.dir === 'next' ? 'pp-shade-out' : 'pp-shade-in'}`}
                style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.30), rgba(0,0,0,0.05) 60%)' }} aria-hidden />
            </div>
          )}

          <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-800 hover:scale-105 transition-all cursor-pointer z-10" aria-label="Close passport">
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => go('prev')} disabled={page === 0 || flip !== null}
            className="w-10 h-10 rounded-full bg-white/95 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-default cursor-pointer transition-all hover:scale-105" aria-label="Previous page">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Passport pages">
            {pages.map((_, i) => (
              <button key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all cursor-pointer ${i === page ? 'w-5 h-2 bg-[#C9A84C]' : 'w-2 h-2 bg-white/50 hover:bg-white/80'}`}
                role="tab" aria-selected={i === page} aria-label={`Page ${i + 1}`} />
            ))}
          </div>
          <button onClick={() => go('next')} disabled={page === pages.length - 1 || flip !== null}
            className="w-10 h-10 rounded-full bg-white/95 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-default cursor-pointer transition-all hover:scale-105" aria-label="Next page">
            <ChevronRight size={18} />
          </button>
        </div>
        <button onClick={() => setExporting(true)} disabled={exporting}
          className="flex items-center gap-2 px-4 h-9 rounded-full bg-[#C9A84C] text-[#1B1450] text-xs font-bold shadow-lg hover:bg-[#D6B65A] disabled:opacity-70 disabled:cursor-wait cursor-pointer transition-all">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {exporting ? 'Preparing PDF…' : 'Download PDF'}
        </button>
        <p className="text-[10px] text-white/50 font-semibold tracking-wide">Use ← → arrow keys to flip pages</p>
      </div>

      {exporting && (
        <div ref={exportRef} aria-hidden className={roboto.className}
          style={{ position: 'fixed', left: -100000, top: 0, ['--pp-scale' as string]: 1 } as React.CSSProperties}>
          {pages.map((p, i) => (
            <div key={i} className="relative overflow-hidden" style={{ width: PW, height: PH }}>{p}</div>
          ))}
        </div>
      )}
    </div>
  );
}
