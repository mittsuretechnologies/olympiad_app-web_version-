'use client';

// Holistic Progress Passport — booklet styled to match the official "Junior
// Power Quest" passport PDF: dark cover → ID card (photo) → welcome letter →
// written-round performance (chunked) → talent-round overview → panchakosha
// profile (star-rated) → panchakosha summary (puzzle wheel) → insights →
// parent/teacher reflection → recommended tools → back cover. All content is
// driven by the student's real data from /api/result/overview; sections with
// no data source yet (age, batch, assessment date) show "Not available".

import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, School, MapPin, Hash, GraduationCap, Video as VideoIcon } from 'lucide-react';
import type { CriterionKey } from '@/lib/kosh';

/* ── Data shapes (mirrors /api/result/overview) ─────────────── */

interface PassportExamQuestion {
  questionNumber: number;
  pageNumber: number;
  questionText: string | null;
  questionType: string | null;
  maxMarks: number;
  score: number | null;
  percentage: number | null;
  koshas: { kosha: string; earned: number; weight: number }[];
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

/* ── Question-level grading band (no per-question rubric exists —
   derived from percentage, same bands as the kosha grading) ────── */

type Grade = 'Beginner' | 'Progressing' | 'Proficient';

function bandFromPercent(pct: number): Grade {
  if (pct >= 70) return 'Proficient';
  if (pct >= 40) return 'Progressing';
  return 'Beginner';
}

const GRADE_STYLE: Record<Grade, { color: string; bg: string; border: string }> = {
  Proficient:  { color: '#0E9F6E', bg: '#EAF7F1', border: '#B3E4D0' },
  Progressing: { color: '#2563EB', bg: '#EDF2FE', border: '#BCD0F7' },
  Beginner:    { color: '#D9950C', bg: '#FCF5E6', border: '#F1DCA8' },
};

// question_type is a code (e.g. "circle_correct") — scanner.questions has no
// free-text instruction column yet. This label is a readable stand-in until
// one lands; swap in the real instruction text there once it exists.
const QUESTION_TYPE_LABELS: Record<string, string> = {
  trace_dotted_bands: 'Trace the dotted lines.',
  circle_correct: 'Circle the correct answer.',
  color_image: 'Colour the picture.',
  color_by_rule: 'Colour as indicated.',
  color_correct_picture: 'Identify and colour the correct picture.',
  missing_letter: 'Fill in the missing letter.',
};

// Prefers the real instruction text (now stored on scanner.questions); falls
// back to a readable label derived from question_type for older scans that
// predate that column, and finally to a plain "Question N." placeholder.
function questionLabel(text: string | null, type: string | null, num: number): string {
  if (text) return text;
  if (!type) return `Question ${num}.`;
  if (QUESTION_TYPE_LABELS[type]) return QUESTION_TYPE_LABELS[type];
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + '.';
}

const KOSH_THEME: Record<string, { accent: string; soft: string; ring: string; tagline: string; skills: string[] }> = {
  ANNAMAYA:    { accent: '#0E9F6E', soft: '#EAF7F1', ring: '#B3E4D0', tagline: 'The Physical Body', skills: ['Fine Motor Skill', 'Gross Motor Skill', 'Coordination'] },
  PRANAMAYA:   { accent: '#D9950C', soft: '#FCF5E6', ring: '#F1DCA8', tagline: 'The Energy Body', skills: ['Vitality', 'Breath Awareness', 'Energy'] },
  MANOMAYA:    { accent: '#DC2626', soft: '#FDEEEE', ring: '#F3C0C0', tagline: 'The Mind Body', skills: ['Emotional Awareness', 'Self-regulation', 'Moral Reasoning'] },
  VIJNANAMAYA: { accent: '#7C3AED', soft: '#F2EDFD', ring: '#D6C4F5', tagline: 'The Wisdom Body', skills: ['Cognitive Skills', 'Problem Solving', 'Early Learning'] },
  ANANDAMAYA:  { accent: '#D97706', soft: '#FDF3E7', ring: '#F3D9AE', tagline: 'The Bliss Body', skills: ['Creativity', 'Self-expression', 'Joy & Happiness'] },
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function Rise({ delay = 0, children, className = '' }: { delay?: number; children: React.ReactNode; className?: string }) {
  return <div className={`pp2-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</div>;
}

function Stars() {
  const stars = [
    { top: '12%', left: '14%', size: 3, delay: 0 }, { top: '20%', left: '78%', size: 2, delay: 0.8 },
    { top: '34%', left: '8%',  size: 2, delay: 1.6 }, { top: '44%', left: '88%', size: 3, delay: 0.4 },
    { top: '66%', left: '12%', size: 2, delay: 2.1 }, { top: '74%', left: '82%', size: 3, delay: 1.1 },
    { top: '85%', left: '30%', size: 2, delay: 0.2 }, { top: '9%',  left: '48%', size: 2, delay: 1.9 },
  ] as const;
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {stars.map((s, i) => (
        <span key={i} className="absolute rounded-full bg-[#FFD873] pp2-twinkle"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
      ))}
    </div>
  );
}

function PageFrame({ children, footerRight, bg = '#FBF3E1' }: {
  children: React.ReactNode; footerLeft: string; footerRight: string; bg?: string;
}) {
  return (
    <div className="w-full h-full rounded-2xl flex flex-col overflow-hidden relative border-2 border-dashed" style={{ background: bg, borderColor: '#D9BE8C' }}>
      <div className="flex-1 min-h-0 px-6 pt-5 pb-2 flex flex-col relative overflow-y-auto">{children}</div>
      <div className="px-6 py-2 flex items-center justify-center relative">
        <span className="text-[10px] font-bold text-[#8A6D3B] bg-[#FBF3E1] px-2 rounded-full border border-[#D9BE8C] w-6 h-6 flex items-center justify-center">{footerRight}</span>
      </div>
    </div>
  );
}

/* ── Page 1: Cover ──────────────────────────────────────────── */

function CoverPage() {
  return (
    <div className="w-full h-full rounded-2xl flex flex-col items-center justify-center gap-4 text-center px-8 relative overflow-hidden border-2 border-dashed border-[#C9A84C]/50" style={{ background: '#1B1450' }}>
      <Stars />
      <div className="absolute inset-3 rounded-xl border border-[#C9A84C]/40 pointer-events-none" />
      <Rise delay={60}>
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-[10px] font-black text-white">M</div>
          <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center text-[10px]">🏅</div>
          <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-[10px] font-black text-white">M</div>
        </div>
      </Rise>
      <Rise delay={160}>
        <h2 className="text-2xl font-black text-white tracking-wide leading-tight">MITTSURE<br /><span className="text-[#3DBB6E]">OLYMPIAD</span><br />MASTERS</h2>
      </Rise>
      <Rise delay={240}>
        <p className="text-sm font-black text-[#F5C451] tracking-wide uppercase">Junior Power Quest</p>
      </Rise>
      <Rise delay={340}>
        <div className="w-28 h-28 rounded-full border-4 border-dashed border-[#F5C451] flex items-center justify-center relative pp2-spin-slow" style={{ animationDuration: '30s' }}>
          <div className="w-20 h-20 rounded-full bg-[#F5C451] flex items-center justify-center text-3xl">🐾</div>
        </div>
      </Rise>
      <Rise delay={460}>
        <p className="text-sm font-black text-[#F5C451] uppercase tracking-wide mt-2">Holistic Progress Passport</p>
        <p className="text-[10px] text-[#F5C451]/70 font-semibold mt-1">Beginner &nbsp;|&nbsp; Progressing &nbsp;|&nbsp; Proficient</p>
      </Rise>
    </div>
  );
}

/* ── Page 2: ID Card ────────────────────────────────────────── */

function IdCardPage({ s }: { s: PassportV2Student }) {
  const fields: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Hash size={11} />,          label: 'Age',              value: 'Not available' },
    { icon: <GraduationCap size={11} />, label: 'Development Stage', value: s.className || 'Not available' },
    { icon: <School size={11} />,        label: 'School',           value: s.schoolName || 'Not available' },
    { icon: <MapPin size={11} />,        label: 'Region',           value: [s.city, s.district, s.state].filter(Boolean).join(', ') || 'Not available' },
    { icon: <Hash size={11} />,          label: 'Olympiad ID',      value: s.olympiadCode },
    { icon: <Hash size={11} />,          label: 'Batch',            value: 'Not available' },
    { icon: <Hash size={11} />,          label: 'Assessment Date',  value: 'Not available' },
  ];
  return (
    <PageFrame footerLeft="ID" footerRight="2">
      <Rise delay={20}>
        <h2 className="text-center text-lg font-black text-[#1B1450] leading-tight">MOM JUNIOR POWER QUEST</h2>
        <p className="text-center text-[9px] font-bold text-[#8A6D3B] uppercase tracking-widest">Holistic Progress Passport</p>
      </Rise>
      <div className="mt-4 border-2 border-dashed border-[#D9BE8C] rounded-xl p-4 flex-1">
        <Rise delay={100}>
          <div className="w-24 h-28 rounded-lg bg-gradient-to-br from-[#1B1450] to-[#3A2C8A] flex items-center justify-center overflow-hidden mx-auto mb-3 relative">
            {s.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.avatarUrl} alt={s.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-[#F5E9C8]">{initials(s.name)}</span>
            )}
          </div>
        </Rise>
        <Rise delay={160}>
          <p className="text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest">Name</p>
          <p className="text-center text-base font-black text-gray-900 mb-3">{s.name}</p>
        </Rise>
        <div className="space-y-1.5">
          {fields.map((f, i) => (
            <Rise key={f.label} delay={220 + i * 60}>
              <div className="flex items-center gap-2">
                <span className="text-[#8A6D3B] flex-shrink-0">{f.icon}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest w-28 flex-shrink-0">{f.label}</span>
                <span className="text-[10.5px] font-bold text-gray-800 truncate">{f.value}</span>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </PageFrame>
  );
}

/* ── Page 3: Welcome ────────────────────────────────────────── */

function WelcomePage({ s }: { s: PassportV2Student }) {
  const firstName = s.name.split(' ')[0];
  return (
    <PageFrame footerLeft="WELCOME" footerRight="3">
      <Rise delay={20}>
        <div className="mx-auto bg-[#1B1450] text-white text-center py-2 px-4 rounded-full text-xs font-black uppercase tracking-wide">
          Welcome to Junior Power Quest
        </div>
      </Rise>
      <Rise delay={140} className="flex-1 flex flex-col justify-center">
        <div className="border-2 border-dashed border-[#D9BE8C] rounded-xl p-4 mt-4">
          <p className="text-sm font-bold text-gray-500 mb-2">Dear {firstName},</p>
          <p className="text-[11.5px] text-gray-700 leading-relaxed">
            You are officially a citizen of MOM JUNIOR POWER QUEST — a world where every little power shines!
            This passport shows your journey, your powers, and your growth across 5 magical dimensions.
          </p>
          <p className="text-[11.5px] font-bold text-gray-700 mt-3">Keep exploring, keep growing!</p>
        </div>
      </Rise>
      <Rise delay={320} className="mt-auto">
        <p className="text-center text-sm font-black text-[#1B1450]">Let the adventure continue!</p>
      </Rise>
    </PageFrame>
  );
}

/* ── Written round pages (chunked, real per-question data) ──── */

const QUESTIONS_PER_PAGE = 10;

function WrittenRoundPage({ questions, part, totalParts, pageNo }: {
  questions: PassportExamQuestion[]; part: number; totalParts: number; pageNo: number;
}) {
  return (
    <PageFrame footerLeft="WRITTEN" footerRight={String(pageNo)}>
      <Rise delay={20}>
        <h3 className="text-center text-base font-black text-[#1B1450] uppercase">Performance Overview</h3>
        <p className="text-center text-[10px] font-bold text-[#8A6D3B] uppercase tracking-widest">Written Round</p>
        <div className="mx-auto mt-1 bg-white border border-[#D9BE8C] rounded-full px-3 py-0.5 w-fit text-[10px] font-black text-[#1B1450]">PART {part}{totalParts > 1 ? `/${totalParts}` : ''}</div>
      </Rise>
      <div className="mt-3 border-2 border-dashed border-[#D9BE8C] rounded-xl overflow-hidden flex-1">
        <div className="grid grid-cols-[1fr_auto] bg-[#F1DFAF] text-[9px] font-black text-[#5C4A1E] uppercase tracking-wide px-3 py-2">
          <span>Question Instruction</span><span>Performance Level</span>
        </div>
        {questions.map((q, i) => {
          const grade = q.percentage !== null ? bandFromPercent(q.percentage) : 'Beginner';
          const style = GRADE_STYLE[grade];
          return (
            <Rise key={q.questionNumber} delay={80 + i * 40}>
              <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 border-t border-[#EADCB8] bg-white/60">
                <span className="text-[10.5px] font-semibold text-gray-700">{q.questionNumber}. {questionLabel(q.questionText, q.questionType, q.questionNumber)}</span>
                <span className="text-[8.5px] font-black uppercase tracking-wide px-2 py-1 rounded-full border whitespace-nowrap"
                  style={{ color: style.color, background: style.bg, borderColor: style.border }}>
                  {q.score !== null ? grade : 'Pending'}
                </span>
              </div>
            </Rise>
          );
        })}
      </div>
    </PageFrame>
  );
}

/* ── Talent round overview ────────────────────────────────────*/

function TalentRoundPage({ s, pageNo }: { s: PassportV2Student; pageNo: number }) {
  const videos = [...s.videos].sort((a, b) => a.slot - b.slot).slice(0, 2);
  return (
    <PageFrame footerLeft="TALENT" footerRight={String(pageNo)}>
      <Rise delay={20}>
        <div className="bg-[#8A6D3B] text-white text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-lg inline-block">Talent Round (Performance Overview)</div>
      </Rise>
      <div className="mt-3 space-y-1">
        {videos.map((v, i) => (
          <Rise key={v.id} delay={80 + i * 60}>
            <p className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
              <VideoIcon size={11} className="text-[#8A6D3B]" /> Video {i + 1}: {v.category || v.subCategory || 'Talent Performance'}
            </p>
          </Rise>
        ))}
        {videos.length === 0 && <p className="text-[10px] text-gray-400 font-semibold">No videos submitted yet.</p>}
      </div>

      <div className="mt-4 border-2 border-dashed border-[#D9BE8C] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] bg-[#F1DFAF] text-[9px] font-black text-[#5C4A1E] uppercase tracking-wide px-3 py-2">
          <span>Panchakosha Domain</span><span>Performance Level</span>
        </div>
        {s.koshBreakdown.map((k, i) => {
          const grade = k.grade;
          const style = grade ? GRADE_STYLE[grade] : { color: '#9CA3AF', bg: '#F3F4F6', border: '#E5E7EB' };
          return (
            <Rise key={k.kosh} delay={160 + i * 60}>
              <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 border-t border-[#EADCB8] bg-white/60">
                <span className="text-[10.5px] font-semibold text-gray-700">{k.label}</span>
                <span className="text-[8.5px] font-black uppercase tracking-wide px-2 py-1 rounded-full border whitespace-nowrap"
                  style={{ color: style.color, background: style.bg, borderColor: style.border }}>
                  {grade || 'Pending'}
                </span>
              </div>
            </Rise>
          );
        })}
      </div>

      <Rise delay={520} className="mt-auto">
        <div className="bg-white/70 border border-[#D9BE8C] rounded-xl p-3 mt-3">
          <p className="text-[9px] font-black text-[#1B1450] uppercase mb-1">Remarks</p>
          <p className="text-[10px] text-gray-600 leading-relaxed">
            {s.name.split(' ')[0]} scored {s.holisticPercent !== null ? `${s.holisticPercent}%` : 'pending'} overall across the written and talent rounds.
            Continued practice will help build further confidence and proficiency.
          </p>
        </div>
      </Rise>
    </PageFrame>
  );
}

/* ── Panchakosha profile (star-rated) ─────────────────────────*/

function starsFromPercent(pct: number | null): number {
  if (pct === null) return 0;
  return Math.max(0, Math.min(5, Math.round((pct / 100) * 5)));
}

function StarRow({ filled, accent, delay }: { filled: number; accent: string; delay: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Rise key={i} delay={delay + i * 40}>
          <span style={{ color: i < filled ? accent : '#E5E7EB' }} className="text-sm">★</span>
        </Rise>
      ))}
    </div>
  );
}

function PanchakoshaProfilePage({ s, pageNo }: { s: PassportV2Student; pageNo: number }) {
  return (
    <PageFrame footerLeft="PROFILE" footerRight={String(pageNo)}>
      <Rise delay={20}>
        <h3 className="text-center text-base font-black text-[#1B1450] uppercase">Panchakosha Profile</h3>
        <p className="text-center text-[9.5px] text-gray-500 font-semibold">Integrating Academic Learning and Talent for Holistic Development</p>
      </Rise>
      <div className="mt-3 space-y-2 flex-1">
        {s.koshBreakdown.map((k, i) => {
          const theme = KOSH_THEME[k.kosh] || KOSH_THEME.ANNAMAYA;
          const stars = starsFromPercent(k.combinedPercent);
          return (
            <Rise key={k.kosh} delay={80 + i * 90}>
              <div className="rounded-xl border p-2.5" style={{ background: theme.soft, borderColor: theme.ring }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full text-white" style={{ background: theme.accent }}>
                    {k.label}
                  </span>
                  <span className="text-[9px] font-black uppercase" style={{ color: theme.accent }}>{k.grade || 'Pending'}</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  {theme.skills.map(skill => (
                    <span key={skill} className="text-[8.5px] font-semibold text-gray-500 bg-white/70 px-1.5 py-0.5 rounded-full border border-gray-200">{skill}</span>
                  ))}
                </div>
                <StarRow filled={stars} accent={theme.accent} delay={200 + i * 90} />
              </div>
            </Rise>
          );
        })}
      </div>
    </PageFrame>
  );
}

/* ── Panchakosha summary (puzzle wheel) ───────────────────────*/

function overallLevel(pct: number | null): Grade | null {
  if (pct === null) return null;
  return bandFromPercent(pct);
}

function PanchakoshaSummaryPage({ s, pageNo }: { s: PassportV2Student; pageNo: number }) {
  const level = overallLevel(s.holisticPercent);
  const style = level ? GRADE_STYLE[level] : { color: '#9CA3AF', bg: '#F3F4F6', border: '#E5E7EB' };
  return (
    <PageFrame footerLeft="SUMMARY" footerRight={String(pageNo)}>
      <Rise delay={20}>
        <h3 className="text-center text-base font-black text-[#1B1450] uppercase">Panchakosha Summary</h3>
      </Rise>
      <div className="flex-1 flex items-center justify-center py-4">
        <Rise delay={120}>
          <div className="relative w-52 h-52">
            <div className="absolute inset-0 rounded-full border-8 border-dashed" style={{ borderColor: style.color + '55' }} />
            <div className="absolute inset-6 rounded-full flex flex-col items-center justify-center text-center bg-white shadow-inner">
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Growth Chart of</p>
              <p className="text-sm font-black text-[#1B1450]">{s.name.split(' ')[0]}</p>
            </div>
            {s.koshBreakdown.map((k, i) => {
              const theme = KOSH_THEME[k.kosh] || KOSH_THEME.ANNAMAYA;
              const angle = (i / s.koshBreakdown.length) * 2 * Math.PI - Math.PI / 2;
              const r = 84;
              const x = 104 + r * Math.cos(angle);
              const y = 104 + r * Math.sin(angle);
              return (
                <Rise key={k.kosh} delay={200 + i * 90} className="absolute" >
                  <div className="absolute flex flex-col items-center" style={{ left: x - 30, top: y - 20, width: 60 }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[9px] font-black shadow" style={{ background: theme.accent }}>
                      {k.combinedPercent !== null ? `${Math.round(k.combinedPercent)}%` : '—'}
                    </div>
                    <span className="text-[7.5px] font-bold text-gray-500 text-center mt-1 leading-tight">{k.label.replace(' Kosh', '')}</span>
                  </div>
                </Rise>
              );
            })}
          </div>
        </Rise>
      </div>
      <Rise delay={640} className="mt-auto">
        <div className="rounded-xl p-3 text-center border" style={{ background: style.bg, borderColor: style.border }}>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Overall Holistic Growth Level</p>
          <p className="text-xl font-black" style={{ color: style.color }}>{level || 'Pending'}</p>
          <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{s.holisticPercent !== null ? `${s.holisticPercent}% overall` : 'Awaiting full evaluation'}</p>
        </div>
      </Rise>
    </PageFrame>
  );
}

/* ── Insights (static guidance, same across students) ────────*/

const INSIGHTS = [
  { icon: '💪', title: 'Physical Development', text: 'Encourage outdoor play, yoga, balancing activities, running, jumping, and fine motor tasks such as colouring, threading, and clay modelling.' },
  { icon: '🌱', title: 'Vitality & Well-being', text: 'Practise simple breathing exercises, maintain healthy eating habits, ensure adequate sleep, and encourage active play every day.' },
  { icon: '📖', title: 'Language & Literacy', text: 'Read storybooks together, encourage conversations, sing rhymes, introduce new vocabulary, and provide storytelling opportunities.' },
  { icon: '❤️', title: 'Socio-emotional & Ethical', text: 'Promote kindness, sharing, gratitude, and respectful communication through family interactions and group activities.' },
  { icon: '🧠', title: 'Cognitive Development', text: 'Explore puzzles, sorting games, building blocks, observation activities, and simple problem-solving tasks.' },
  { icon: '🎨', title: 'Aesthetic & Cultural', text: 'Encourage drawing, painting, music, dance, storytelling, craft work, and imaginative play to inspire creativity.' },
];

function InsightsPage({ pageNo }: { pageNo: number }) {
  return (
    <PageFrame footerLeft="INSIGHTS" footerRight={String(pageNo)}>
      <Rise delay={20}>
        <h3 className="text-center text-base font-black text-[#1B1450] uppercase">Insights</h3>
        <p className="text-center text-[9.5px] text-gray-500 font-semibold">Discovering Strengths, Inspiring Growth</p>
      </Rise>
      <div className="mt-3 grid grid-cols-2 gap-2 flex-1 overflow-y-auto">
        {INSIGHTS.map((ins, i) => (
          <Rise key={ins.title} delay={80 + i * 60}>
            <div className="bg-white/70 border border-[#D9BE8C] rounded-xl p-2.5 h-full">
              <div className="text-lg mb-1">{ins.icon}</div>
              <p className="text-[9.5px] font-black text-[#1B1450] leading-tight mb-1">{ins.title}</p>
              <p className="text-[8.5px] text-gray-500 leading-snug">{ins.text}</p>
            </div>
          </Rise>
        ))}
      </div>
    </PageFrame>
  );
}

/* ── Parent/Teacher reflection (static form) ──────────────────*/

function ReflectionPage({ pageNo }: { pageNo: number }) {
  const items = [
    'The child participated in activities with great enthusiasm',
    "The child's greatest strength was confidence and creativity",
    'The child enjoyed written activities and talent round performance',
    'The child showed improvement in listening and thinking skills',
  ];
  return (
    <PageFrame footerLeft="REFLECTION" footerRight={String(pageNo)}>
      <Rise delay={20}>
        <h3 className="text-center text-base font-black text-[#1B1450] uppercase">Parent &amp; Teacher Reflections</h3>
      </Rise>
      <div className="mt-3 space-y-2 flex-1">
        {items.map((item, i) => (
          <Rise key={item} delay={80 + i * 70}>
            <div className="flex items-start gap-2 bg-white/70 border border-[#D9BE8C] rounded-lg px-3 py-2">
              <span className="w-3.5 h-3.5 rounded border-2 border-[#8A6D3B] flex-shrink-0 mt-0.5" />
              <span className="text-[10px] font-semibold text-gray-600 leading-snug">{item}</span>
            </div>
          </Rise>
        ))}
      </div>
      <Rise delay={420} className="mt-auto">
        <div className="border-2 border-dashed border-[#D9BE8C] rounded-xl p-3 text-[10px] text-gray-500 font-semibold space-y-1.5">
          <p>Name: ___________________________</p>
          <p>Date: ___________________________</p>
          <p>Signature: ___________________________</p>
        </div>
      </Rise>
    </PageFrame>
  );
}

/* ── Recommended tools (static) ───────────────────────────────*/

const TOOLS = [
  { icon: '🧩', title: 'Building Blocks, Shape Sorter', develops: 'Logical Thinking' },
  { icon: '🧵', title: 'Colouring Kit, Clay/Play Dough', develops: 'Creativity & Fine Motor Skills' },
  { icon: '📚', title: 'Storybooks, Flashcards', develops: 'Language & Communication' },
  { icon: '🎵', title: 'Musical Toys, Pretend Play Set', develops: 'Confidence & Self-expression' },
];

function ToolsPage({ pageNo }: { pageNo: number }) {
  return (
    <PageFrame footerLeft="GROWTH" footerRight={String(pageNo)}>
      <Rise delay={20}>
        <h3 className="text-center text-base font-black text-[#1B1450] uppercase">Keep Growing!</h3>
        <p className="text-center text-[9.5px] text-gray-500 font-semibold">Every Little Step Leads to a Brighter Tomorrow</p>
      </Rise>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {TOOLS.map((t, i) => (
          <Rise key={t.title} delay={80 + i * 70}>
            <div className="bg-white/70 border border-[#D9BE8C] rounded-xl p-2.5 text-center">
              <div className="text-lg">{t.icon}</div>
              <p className="text-[9px] font-black text-gray-700 leading-tight mt-1">{t.title}</p>
              <p className="text-[8px] font-bold text-[#8A6D3B] mt-1 uppercase">{t.develops}</p>
            </div>
          </Rise>
        ))}
      </div>
      <Rise delay={420} className="mt-auto">
        <div className="bg-[#1B1450] text-white rounded-xl p-3 text-center mt-3">
          <p className="text-[10px] font-bold">Keep exploring, keep smiling, and keep learning!</p>
        </div>
      </Rise>
    </PageFrame>
  );
}

/* ── Back cover ────────────────────────────────────────────── */

function BackCoverPage() {
  return (
    <div className="w-full h-full rounded-2xl flex items-end justify-center pb-6 relative overflow-hidden border-2 border-dashed border-[#C9A84C]/50" style={{ background: '#1B1450' }}>
      <p className="text-[10px] text-[#F5C451]/70 font-semibold">© MOM Junior Power Quest</p>
    </div>
  );
}

/* ── The booklet ────────────────────────────────────────────── */

export default function ResultPassportV2({ student, onClose }: { student: PassportV2Student; onClose: () => void }) {
  const writtenParts: PassportExamQuestion[][] = [];
  for (let i = 0; i < student.examQuestions.length; i += QUESTIONS_PER_PAGE) {
    writtenParts.push(student.examQuestions.slice(i, i + QUESTIONS_PER_PAGE));
  }

  let pageNo = 1;
  const pages: React.ReactNode[] = [
    <CoverPage key="cover" />,
    <IdCardPage key="id" s={student} />,
    <WelcomePage key="welcome" s={student} />,
    ...writtenParts.map((qs, i) => {
      pageNo++;
      return <WrittenRoundPage key={`written-${i}`} questions={qs} part={i + 1} totalParts={writtenParts.length} pageNo={pageNo + 2} />;
    }),
    <TalentRoundPage key="talent" s={student} pageNo={pageNo + 3} />,
    <PanchakoshaProfilePage key="profile" s={student} pageNo={pageNo + 4} />,
    <PanchakoshaSummaryPage key="summary" s={student} pageNo={pageNo + 5} />,
    <InsightsPage key="insights" pageNo={pageNo + 6} />,
    <ReflectionPage key="reflection" pageNo={pageNo + 7} />,
    <ToolsPage key="tools" pageNo={pageNo + 8} />,
    <BackCoverPage key="back" />,
  ];

  const [page, setPage] = useState(0);
  const [turning, setTurning] = useState<'next' | 'prev' | null>(null);

  const go = useCallback((dir: 'next' | 'prev') => {
    setPage(p => {
      const target = dir === 'next' ? p + 1 : p - 1;
      if (target < 0 || target >= pages.length) return p;
      setTurning(dir);
      window.setTimeout(() => setTurning(null), 340);
      return target;
    });
  }, [pages.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go('next');
      else if (e.key === 'ArrowLeft') go('prev');
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  return (
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Result passport for ${student.name}`}>
      <style>{`
        @keyframes pp2-turn-next { 0% { transform: perspective(1400px) rotateY(-70deg); opacity: 0.35; } 100% { transform: perspective(1400px) rotateY(0deg); opacity: 1; } }
        @keyframes pp2-turn-prev { 0% { transform: perspective(1400px) rotateY(70deg); opacity: 0.35; } 100% { transform: perspective(1400px) rotateY(0deg); opacity: 1; } }
        .pp2-turn-next { animation: pp2-turn-next 320ms cubic-bezier(0.22, 1, 0.36, 1); transform-origin: left center; }
        .pp2-turn-prev { animation: pp2-turn-prev 320ms cubic-bezier(0.22, 1, 0.36, 1); transform-origin: right center; }
        @keyframes pp2-rise { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
        .pp2-rise { opacity: 0; animation: pp2-rise 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        @keyframes pp2-twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        .pp2-twinkle { animation: pp2-twinkle 2.8s ease-in-out infinite; }
        @keyframes pp2-spin-slow { to { transform: rotate(360deg); } }
        .pp2-spin-slow { animation: pp2-spin-slow 40s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pp2-turn-next, .pp2-turn-prev, .pp2-twinkle, .pp2-spin-slow { animation: none; }
          .pp2-rise { animation: none; opacity: 1; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        <div className="relative w-[340px] sm:w-[380px] h-[520px] sm:h-[560px]">
          <div className="absolute inset-0 translate-x-[5px] translate-y-[5px] rounded-2xl bg-[#E7E0D0] shadow-md" aria-hidden />
          <div className="absolute inset-0 translate-x-[2.5px] translate-y-[2.5px] rounded-2xl bg-[#F1EBDD] shadow" aria-hidden />
          <div key={page} className={`absolute inset-0 rounded-2xl shadow-2xl ${turning === 'next' ? 'pp2-turn-next' : turning === 'prev' ? 'pp2-turn-prev' : ''}`}>
            {pages[page]}
          </div>
          <button onClick={onClose} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-800 hover:scale-105 transition-all cursor-pointer z-10" aria-label="Close passport">
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => go('prev')} disabled={page === 0 || turning !== null}
            className="w-10 h-10 rounded-full bg-white/95 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-default cursor-pointer transition-all hover:scale-105" aria-label="Previous page">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Passport pages">
            {pages.map((_, i) => (
              <button key={i}
                onClick={() => { if (i !== page && turning === null) { setTurning(i > page ? 'next' : 'prev'); setPage(i); window.setTimeout(() => setTurning(null), 340); } }}
                className={`rounded-full transition-all cursor-pointer ${i === page ? 'w-5 h-2 bg-[#C9A84C]' : 'w-2 h-2 bg-white/50 hover:bg-white/80'}`}
                role="tab" aria-selected={i === page} aria-label={`Page ${i + 1}`} />
            ))}
          </div>
          <button onClick={() => go('next')} disabled={page === pages.length - 1 || turning !== null}
            className="w-10 h-10 rounded-full bg-white/95 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-default cursor-pointer transition-all hover:scale-105" aria-label="Next page">
            <ChevronRight size={18} />
          </button>
        </div>
        <p className="text-[10px] text-white/50 font-semibold tracking-wide">Use ← → arrow keys to flip pages</p>
      </div>
    </div>
  );
}
