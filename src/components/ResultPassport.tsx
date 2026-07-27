'use client';

// Result Passport — a booklet-style report styled like a real passport:
// cover → bio (student details) page → one page per kosha (grade shown as a
// visa-style stamp) → final summary page. Pages turn with a 3D flip, and each
// page choreographs its content in with staggered entrances, floating art
// motifs, and a stamp "thump" — all disabled under prefers-reduced-motion.

import { useCallback, useEffect, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, School, MapPin, Hash, GraduationCap,
  Star, CheckCircle2, AlertCircle, Video, FileText,
} from 'lucide-react';
import { KOSH_CRITERIA, MAX_PER_CRITERION, type KoshKey, type CriterionKey } from '@/lib/kosh';

/* ── Data shapes (mirrors /api/result/overview) ─────────────── */

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

export interface PassportStudent {
  studentKey: string;
  name: string;
  olympiadCode: string;
  className: string | null;
  schoolName: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  videos: PassportVideo[];
  examPercentage: number | null;
  videoScoreTotal: number;
  videoMaxScore: number;
  koshBreakdown: PassportKosh[];
  holisticPercent: number | null;
  status: 'Complete' | 'Incomplete';
}

/* ── Kosha accents — one colour identity per kosha page ─────── */

const KOSH_THEME: Record<string, { accent: string; soft: string; ring: string; tagline: string }> = {
  ANNAMAYA:    { accent: '#E0592A', soft: '#FDF0EA', ring: '#F4C4AE', tagline: 'The Physical Body — Coordination' },
  PRANAMAYA:   { accent: '#0E9F6E', soft: '#EAF7F1', ring: '#B3E4D0', tagline: 'The Energy Body — Memory & Energy' },
  MANOMAYA:    { accent: '#D9950C', soft: '#FCF5E6', ring: '#F1DCA8', tagline: 'The Mind Body — Imagination & Emotion' },
  VIJNANAMAYA: { accent: '#2563EB', soft: '#EDF2FE', ring: '#BCD0F7', tagline: 'The Wisdom Body — Focus & Language' },
  ANANDAMAYA:  { accent: '#9333EA', soft: '#F6EEFD', ring: '#DCC2F5', tagline: 'The Bliss Body — Creativity & Joy' },
};

const GRADE_STAMP: Record<string, { color: string; label: string }> = {
  Proficient:  { color: '#0E9F6E', label: 'PROFICIENT' },
  Progressing: { color: '#2563EB', label: 'PROGRESSING' },
  Beginner:    { color: '#D9950C', label: 'BEGINNER' },
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

/* ── Entrance helper: staggered rise-in on mount ────────────── */

function Rise({ delay = 0, children, className = '' }: { delay?: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={`pp-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ── Decorative art: floating shapes in a kosha's colour ────── */

function FloatingArt({ accent }: { accent: string }) {
  // Fixed positions so the art is stable per page (no re-randomising on re-render).
  const shapes = [
    { top: '9%',  right: '5%',  size: 10, kind: 'circle',   dur: 7,   delay: 0 },
    { top: '30%', right: '10%', size: 7,  kind: 'circle',   dur: 9,   delay: 1.2 },
    { top: '58%', left: '4%',   size: 9,  kind: 'diamond',  dur: 8,   delay: 0.6 },
    { top: '76%', right: '7%',  size: 12, kind: 'ring',     dur: 10,  delay: 2 },
    { top: '18%', left: '6%',   size: 8,  kind: 'diamond',  dur: 7.5, delay: 1.6 },
    { top: '88%', left: '14%',  size: 6,  kind: 'circle',   dur: 8.5, delay: 0.3 },
  ] as const;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {shapes.map((s, i) => (
        <span
          key={i}
          className="absolute pp-float"
          style={{
            top: s.top,
            left: 'left' in s ? (s as any).left : undefined,
            right: 'right' in s ? (s as any).right : undefined,
            width: s.size,
            height: s.size,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            borderRadius: s.kind === 'diamond' ? 2 : '50%',
            transform: s.kind === 'diamond' ? 'rotate(45deg)' : undefined,
            background: s.kind === 'ring' ? 'transparent' : accent,
            border: s.kind === 'ring' ? `2px solid ${accent}` : undefined,
            opacity: 0.18,
          }}
        />
      ))}
      {/* Big soft corner blobs */}
      <span className="absolute -top-10 -right-10 w-36 h-36 rounded-full pp-breathe" style={{ background: accent, opacity: 0.07 }} />
      <span className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full pp-breathe" style={{ background: accent, opacity: 0.06, animationDelay: '2s' }} />
      {/* Watermark mandala */}
      <svg className="absolute right-[-34px] bottom-[-34px] w-40 h-40 pp-spin-slow" viewBox="0 0 100 100" fill="none" style={{ opacity: 0.07 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <ellipse key={i} cx="50" cy="26" rx="7" ry="20" stroke={accent} strokeWidth="1.6" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="8" stroke={accent} strokeWidth="1.6" />
      </svg>
    </div>
  );
}

/* ── Twinkling stars for dark (cover / hero) surfaces ───────── */

function Stars() {
  const stars = [
    { top: '12%', left: '14%', size: 3, delay: 0 },
    { top: '20%', left: '78%', size: 2, delay: 0.8 },
    { top: '34%', left: '8%',  size: 2, delay: 1.6 },
    { top: '44%', left: '88%', size: 3, delay: 0.4 },
    { top: '66%', left: '12%', size: 2, delay: 2.1 },
    { top: '74%', left: '82%', size: 3, delay: 1.1 },
    { top: '85%', left: '30%', size: 2, delay: 0.2 },
    { top: '9%',  left: '48%', size: 2, delay: 1.9 },
    { top: '58%', left: '52%', size: 2, delay: 2.6 },
  ] as const;
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {stars.map((s, i) => (
        <span key={i} className="absolute rounded-full bg-[#FFD873] pp-twinkle"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
      ))}
    </div>
  );
}

/* ── Visa-style grade stamp (thumps in on page open) ────────── */

function GradeStamp({ grade, size = 92 }: { grade: string | null; size?: number }) {
  if (!grade) {
    return (
      <div
        className="flex items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-300 text-[9px] font-black uppercase tracking-widest -rotate-12"
        style={{ width: size, height: size }}
      >
        Pending
      </div>
    );
  }
  const s = GRADE_STAMP[grade] || GRADE_STAMP.Beginner;
  return (
    <div
      className="relative flex items-center justify-center -rotate-12 select-none pp-stamp"
      style={{ width: size, height: size }}
      aria-label={`Grade: ${grade}`}
    >
      <div className="absolute inset-0 rounded-full border-[3px] opacity-80" style={{ borderColor: s.color }} />
      <div className="absolute inset-[7px] rounded-full border border-dashed opacity-70 pp-spin-slow" style={{ borderColor: s.color, animationDuration: '30s' }} />
      <span
        className="text-[10px] font-black uppercase tracking-[0.14em] text-center leading-tight px-1.5 opacity-90"
        style={{ color: s.color }}
      >
        {s.label}
      </span>
    </div>
  );
}

/* ── Passport page frame (shared chrome) ────────────────────── */

function PageFrame({ children, footerLeft, footerRight, art }: {
  children: React.ReactNode;
  footerLeft: string;
  footerRight: string;
  art?: React.ReactNode;
}) {
  return (
    <div className="w-full h-full bg-[#FBF8F1] rounded-2xl flex flex-col overflow-hidden relative">
      {/* Guilloche-esque background texture */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{
        backgroundImage: 'repeating-radial-gradient(circle at 50% -20%, #06013E 0, #06013E 1px, transparent 1px, transparent 14px)',
      }} />
      {art}
      <div className="flex-1 min-h-0 px-6 pt-5 pb-2 flex flex-col relative">{children}</div>
      {/* MRZ-style footer strip */}
      <div className="px-6 py-2.5 border-t-2 border-dashed border-gray-300/70 flex items-center justify-between font-mono text-[9.5px] text-gray-400 tracking-[0.2em] uppercase relative bg-[#FBF8F1]/60">
        <span className="truncate">{footerLeft}</span>
        <span className="flex-shrink-0">{footerRight}</span>
      </div>
    </div>
  );
}

/* ── Individual pages ───────────────────────────────────────── */

function CoverPage({ s }: { s: PassportStudent }) {
  return (
    <div className="w-full h-full rounded-2xl flex flex-col items-center justify-center gap-5 text-center px-8 relative overflow-hidden bg-gradient-to-br from-[#06013E] via-[#0B0553] to-[#151067]">
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: 'repeating-radial-gradient(circle at 50% 120%, #FFD873 0, #FFD873 1px, transparent 1px, transparent 16px)',
      }} />
      <Stars />
      {/* Shimmering gold frame */}
      <div className="absolute inset-3 rounded-xl border border-[#C9A84C]/50 pointer-events-none pp-border-glow" />
      <div className="absolute inset-4 rounded-lg border border-[#C9A84C]/25 pointer-events-none" />
      {/* Diagonal shine sweep */}
      <div className="absolute inset-0 pointer-events-none pp-shine" aria-hidden />

      <Rise delay={60}>
        <p className="text-[10px] font-bold tracking-[0.4em] text-[#C9A84C] uppercase">Mittsure Olympiad</p>
      </Rise>

      {/* Emblem — Mittmee logo in a gold-ringed medallion, gently floating */}
      <Rise delay={160}>
        <div className="pp-hover-float">
          <div className="w-24 h-24 rounded-full border-2 border-[#C9A84C] bg-white flex items-center justify-center relative pp-glow overflow-hidden">
            <div className="absolute inset-1.5 rounded-full border border-[#C9A84C]/40 pp-spin-slow z-10" style={{ animationDuration: '24s', borderStyle: 'dashed' }} />
            <img src="/mittmee-icon.jpeg" alt="Mittmee" className="w-16 h-16 object-contain relative" />
          </div>
        </div>
      </Rise>

      <Rise delay={280}>
        <h2 className="text-2xl font-black text-[#F5E9C8] tracking-wide leading-tight">Holistic Progress<br />Passport</h2>
        <p className="text-[10.5px] text-[#C9A84C]/80 font-semibold tracking-[0.25em] uppercase mt-2">Panchkosha Evaluation</p>
      </Rise>

      <Rise delay={400}>
        <div className="flex items-center gap-2 text-[9px] font-bold tracking-[0.3em] text-[#C9A84C]/70 uppercase">
          <span className="w-8 h-px bg-[#C9A84C]/40" /> Exam · Talent Round <span className="w-8 h-px bg-[#C9A84C]/40" />
        </div>
      </Rise>

      {/* Holder name + ID — engraved in gold on the cover */}
      <Rise delay={520}>
        <div className="mt-1">
          <p className="text-base font-black text-[#C9A84C] tracking-[0.12em] uppercase leading-tight break-words max-w-[260px]">{s.name}</p>
          <p className="text-[10px] font-bold font-mono text-[#C9A84C]/75 tracking-[0.35em] mt-1.5">{s.olympiadCode}</p>
        </div>
      </Rise>
    </div>
  );
}

function BioPage({ s }: { s: PassportStudent }) {
  const fields: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Hash size={11} />,          label: 'Olympiad Code', value: s.olympiadCode },
    { icon: <GraduationCap size={11} />, label: 'Class',         value: s.className || '—' },
    { icon: <School size={11} />,        label: 'School',        value: s.schoolName || '—' },
    { icon: <MapPin size={11} />,        label: 'Region',        value: [s.city, s.district, s.state].filter(Boolean).join(', ') || '—' },
  ];
  return (
    <PageFrame
      footerLeft={`P<IND<${s.name.replace(/\s+/g, '<').toUpperCase()}`}
      footerRight={s.olympiadCode}
      art={<FloatingArt accent="#C9A84C" />}
    >
      <Rise delay={40}>
        <p className="text-[9px] font-black tracking-[0.3em] text-gray-400 uppercase mb-3">Holder Identification</p>
      </Rise>
      <div className="flex gap-5 items-start">
        {/* Photo box */}
        <Rise delay={120}>
          <div className="w-24 h-28 rounded-lg bg-gradient-to-br from-[#06013E] to-[#2A2170] flex items-center justify-center flex-shrink-0 relative shadow-inner overflow-hidden">
            <span className="text-3xl font-black text-[#F5E9C8] relative">{initials(s.name)}</span>
            <div className="absolute inset-1 rounded-md border border-white/15 pointer-events-none" />
            <div className="absolute inset-0 pp-shine pointer-events-none" />
          </div>
        </Rise>
        <div className="min-w-0 flex-1">
          <Rise delay={180}>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Name of Holder</p>
            <p className="text-lg font-black text-gray-900 leading-tight mt-0.5 mb-3 break-words">{s.name}</p>
          </Rise>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <Rise key={f.label} delay={240 + i * 70}>
                <div className="flex items-start gap-2">
                  <span className="text-gray-300 mt-0.5 flex-shrink-0">{f.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest">{f.label}</p>
                    <p className="text-[11.5px] font-bold text-gray-800 truncate">{f.value}</p>
                  </div>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-3 grid grid-cols-2 gap-3">
        <Rise delay={560}>
          <div className="bg-white/70 rounded-xl border border-gray-200 px-3 py-2 backdrop-blur-[1px]">
            <p className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest">Status</p>
            <p className={`text-[12px] font-black flex items-center gap-1 ${s.status === 'Complete' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {s.status === 'Complete' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {s.status}
            </p>
          </div>
        </Rise>
        <Rise delay={630}>
          <div className="bg-white/70 rounded-xl border border-gray-200 px-3 py-2 backdrop-blur-[1px]">
            <p className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest">Holistic Score</p>
            <p className="text-[12px] font-black text-[#06013E]">{s.holisticPercent !== null ? `${s.holisticPercent}%` : '—'}</p>
          </div>
        </Rise>
      </div>
    </PageFrame>
  );
}

function KoshPage({ s, k, pageNo }: { s: PassportStudent; k: PassportKosh; pageNo: number }) {
  const theme = KOSH_THEME[k.kosh] || KOSH_THEME.ANNAMAYA;
  const criterion = KOSH_CRITERIA.find(c => c.kosh === (k.kosh as KoshKey));
  // Per-video criterion marks for this kosha (video 1 & 2, in slot order).
  const videoMarks = s.videos
    .filter(v => v.slot < 2)
    .sort((a, b) => a.slot - b.slot)
    .map(v => ({
      slot: v.slot,
      label: criterion ? criterion.labelBySlot[Math.min(v.slot, 1)] : '',
      score: v.criteria && criterion ? v.criteria[criterion.key] : null,
      isPublished: v.isPublished,
    }));

  return (
    <PageFrame footerLeft={`KOSHA<${k.kosh}`} footerRight={`PAGE ${pageNo}`} art={<FloatingArt accent={theme.accent} />}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Rise delay={40}>
            <p className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: theme.accent }}>Kosha Record</p>
            <h3 className="text-xl font-black text-gray-900 leading-tight">{k.label}</h3>
            <p className="text-[10px] font-semibold text-gray-400 mt-0.5">{theme.tagline}</p>
          </Rise>
        </div>
        {/* Stamp thumps in after the header settles */}
        <div className="flex-shrink-0"><GradeStamp grade={k.grade} size={84} /></div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Rise delay={180}>
          <div className="rounded-xl px-3.5 py-3 border relative overflow-hidden" style={{ background: theme.soft, borderColor: theme.ring }}>
            <span className="absolute -right-3 -top-3 w-10 h-10 rounded-full opacity-15" style={{ background: theme.accent }} aria-hidden />
            <p className="text-[8.5px] font-bold text-gray-500 uppercase tracking-widest">Marks</p>
            <p className="text-2xl font-black leading-none mt-1" style={{ color: theme.accent }}>
              {k.videoScore !== null ? <>{k.videoScore}<span className="text-sm text-gray-400 font-bold">/{k.videoMaxScore}</span></> : '—'}
            </p>
          </div>
        </Rise>
        <Rise delay={250}>
          <div className="rounded-xl px-3.5 py-3 border relative overflow-hidden" style={{ background: theme.soft, borderColor: theme.ring }}>
            <span className="absolute -right-3 -top-3 w-10 h-10 rounded-full opacity-15" style={{ background: theme.accent }} aria-hidden />
            <p className="text-[8.5px] font-bold text-gray-500 uppercase tracking-widest">Overall</p>
            <p className="text-2xl font-black leading-none mt-1" style={{ color: theme.accent }}>
              {k.combinedPercent !== null ? `${k.combinedPercent}%` : '—'}
            </p>
          </div>
        </Rise>
      </div>

      {/* Per-video entries — like border-entry rows */}
      <div className="mt-4 space-y-2">
        {videoMarks.map((v, vi) => (
          <Rise key={v.slot} delay={340 + vi * 90}>
            <div className="flex items-center justify-between bg-white/70 border border-gray-200 rounded-lg px-3 py-2 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 min-w-0">
                <Video size={12} className="flex-shrink-0" style={{ color: theme.accent }} />
                <span className="text-[10.5px] font-bold text-gray-700 truncate">Video {v.slot + 1} · {v.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {v.score !== null ? (
                  <>
                    <div className="flex gap-[3px]" aria-hidden>
                      {Array.from({ length: MAX_PER_CRITERION }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-2 h-2 rounded-full ${i < (v.score ?? 0) ? 'pp-pop' : ''}`}
                          style={{
                            background: i < (v.score ?? 0) ? theme.accent : '#E5E7EB',
                            animationDelay: `${480 + vi * 90 + i * 80}ms`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-black" style={{ color: theme.accent }}>{v.score}/{MAX_PER_CRITERION}</span>
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-gray-300 uppercase">Not scored</span>
                )}
              </div>
            </div>
          </Rise>
        ))}
        {videoMarks.length === 0 && (
          <p className="text-[10px] text-gray-400 font-semibold text-center py-2">No videos submitted yet.</p>
        )}
      </div>

      {/* Exam/Video split */}
      <Rise delay={560} className="mt-auto">
        <div className="pt-3 flex items-center justify-between text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">
          <span className="flex items-center gap-1"><FileText size={10} /> Exam: {k.examPercent !== null ? `${k.examPercent}%` : '—'}</span>
          <span className="flex items-center gap-1"><Video size={10} /> Videos: {k.videoPercent !== null ? `${k.videoPercent}%` : '—'}</span>
        </div>
      </Rise>
    </PageFrame>
  );
}

function SummaryPage({ s }: { s: PassportStudent }) {
  return (
    <PageFrame footerLeft="FINAL<ASSESSMENT" footerRight={s.olympiadCode} art={<FloatingArt accent="#C9A84C" />}>
      <Rise delay={40}>
        <p className="text-[9px] font-black tracking-[0.3em] text-gray-400 uppercase mb-3">Final Assessment</p>
      </Rise>

      {/* Holistic headline */}
      <Rise delay={120}>
        <div className="rounded-2xl bg-gradient-to-br from-[#06013E] to-[#2A2170] text-center py-5 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
            backgroundImage: 'repeating-radial-gradient(circle at 50% 140%, #FFD873 0, #FFD873 1px, transparent 1px, transparent 12px)',
          }} />
          <Stars />
          <div className="absolute inset-0 pp-shine pointer-events-none" />
          <p className="text-[9px] font-bold tracking-[0.3em] text-[#C9A84C] uppercase relative">Holistic Score</p>
          <p className="text-4xl font-black text-[#F5E9C8] mt-1 relative">{s.holisticPercent !== null ? `${s.holisticPercent}%` : '—'}</p>
        </div>
      </Rise>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Rise delay={220}>
          <div className="bg-white/70 rounded-xl border border-gray-200 px-3 py-2.5 backdrop-blur-[1px]">
            <p className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest">Exam</p>
            <p className="text-base font-black text-gray-800">{s.examPercentage !== null ? `${s.examPercentage}%` : 'Not scanned'}</p>
          </div>
        </Rise>
        <Rise delay={280}>
          <div className="bg-white/70 rounded-xl border border-gray-200 px-3 py-2.5 backdrop-blur-[1px]">
            <p className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest">Videos</p>
            <p className="text-base font-black text-gray-800">{s.videoScoreTotal}<span className="text-xs text-gray-400">/{s.videoMaxScore}</span></p>
          </div>
        </Rise>
      </div>

      {/* All-kosha strip */}
      <div className="mt-3 space-y-1.5">
        {s.koshBreakdown.map((k, i) => {
          const theme = KOSH_THEME[k.kosh] || KOSH_THEME.ANNAMAYA;
          return (
            <Rise key={k.kosh} delay={360 + i * 70}>
              <div className="flex items-center gap-2 bg-white/70 border border-gray-200 rounded-lg px-2.5 py-1.5 backdrop-blur-[1px]">
                <span className="w-2 h-2 rounded-full flex-shrink-0 pp-pop" style={{ background: theme.accent, animationDelay: `${420 + i * 70}ms` }} />
                <span className="text-[10px] font-bold text-gray-700 flex-1 truncate">{k.label}</span>
                <span className="text-[10px] font-black text-gray-500">{k.videoScore !== null ? `${k.videoScore}/${k.videoMaxScore}` : '—'}</span>
                <span className="text-[10px] font-black w-11 text-right" style={{ color: theme.accent }}>
                  {k.combinedPercent !== null ? `${k.combinedPercent}%` : '—'}
                </span>
                {k.grade && (
                  <span className="text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full border flex-shrink-0"
                    style={{ color: GRADE_STAMP[k.grade].color, borderColor: GRADE_STAMP[k.grade].color }}>
                    {k.grade}
                  </span>
                )}
              </div>
            </Rise>
          );
        })}
      </div>

      <Rise delay={780} className="mt-auto">
        <div className="pt-2 flex items-center justify-center gap-2 text-[9px] font-bold text-gray-300 uppercase tracking-[0.25em]">
          <Star size={10} className="text-[#C9A84C] fill-current pp-twinkle" /> Mittsure Olympiad <Star size={10} className="text-[#C9A84C] fill-current pp-twinkle" style={{ animationDelay: '1.2s' }} />
        </div>
      </Rise>
    </PageFrame>
  );
}

/* ── The booklet ────────────────────────────────────────────── */

export default function ResultPassport({ student, onClose }: { student: PassportStudent; onClose: () => void }) {
  // Pages: cover, bio, one per kosha, summary.
  const pages: React.ReactNode[] = [
    <CoverPage key="cover" s={student} />,
    <BioPage key="bio" s={student} />,
    ...student.koshBreakdown.map((k, i) => <KoshPage key={k.kosh} s={student} k={k} pageNo={i + 2} />),
    <SummaryPage key="summary" s={student} />,
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
    <div
      className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Result passport for ${student.name}`}
    >
      <style>{`
        @keyframes passport-turn-next {
          0%   { transform: perspective(1400px) rotateY(-70deg); opacity: 0.35; }
          100% { transform: perspective(1400px) rotateY(0deg); opacity: 1; }
        }
        @keyframes passport-turn-prev {
          0%   { transform: perspective(1400px) rotateY(70deg); opacity: 0.35; }
          100% { transform: perspective(1400px) rotateY(0deg); opacity: 1; }
        }
        .passport-turn-next { animation: passport-turn-next 320ms cubic-bezier(0.22, 1, 0.36, 1); transform-origin: left center; }
        .passport-turn-prev { animation: passport-turn-prev 320ms cubic-bezier(0.22, 1, 0.36, 1); transform-origin: right center; }

        /* Content entrance: rise + fade, staggered via inline delay */
        @keyframes pp-rise {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .pp-rise { opacity: 0; animation: pp-rise 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }

        /* Stamp thump: overshoot scale + settle, like a rubber stamp landing */
        @keyframes pp-stamp {
          0%   { opacity: 0; transform: rotate(-12deg) scale(2.1); }
          55%  { opacity: 1; transform: rotate(-12deg) scale(0.92); }
          75%  { transform: rotate(-12deg) scale(1.05); }
          100% { opacity: 1; transform: rotate(-12deg) scale(1); }
        }
        .pp-stamp { animation: pp-stamp 480ms cubic-bezier(0.3, 1.2, 0.4, 1) 320ms both; }

        /* Dot-meter pop */
        @keyframes pp-pop {
          0%   { transform: scale(0); }
          70%  { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        .pp-pop { animation: pp-pop 320ms cubic-bezier(0.3, 1.4, 0.5, 1) both; }

        /* Ambient float for decorative shapes */
        @keyframes pp-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-9px) rotate(8deg); }
        }
        .pp-float { animation: pp-float 8s ease-in-out infinite; }

        /* Slow breathing blobs */
        @keyframes pp-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.12); }
        }
        .pp-breathe { animation: pp-breathe 7s ease-in-out infinite; }

        /* Emblem hover-float on the cover */
        @keyframes pp-hover-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        .pp-hover-float { animation: pp-hover-float 4.5s ease-in-out infinite; }

        /* Soft pulsing glow behind the emblem */
        @keyframes pp-glow {
          0%, 100% { box-shadow: 0 0 18px 2px rgba(201, 168, 76, 0.25); }
          50%      { box-shadow: 0 0 30px 8px rgba(201, 168, 76, 0.45); }
        }
        .pp-glow { animation: pp-glow 3.5s ease-in-out infinite; }

        /* Twinkling stars */
        @keyframes pp-twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50%      { opacity: 1; transform: scale(1.2); }
        }
        .pp-twinkle { animation: pp-twinkle 2.8s ease-in-out infinite; }

        /* Slow mandala spin */
        @keyframes pp-spin-slow { to { transform: rotate(360deg); } }
        .pp-spin-slow { animation: pp-spin-slow 40s linear infinite; }

        /* Diagonal shine sweep across dark surfaces */
        @keyframes pp-shine {
          0%   { transform: translateX(-130%) skewX(-18deg); }
          60%, 100% { transform: translateX(230%) skewX(-18deg); }
        }
        .pp-shine::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0; width: 45%;
          background: linear-gradient(90deg, transparent, rgba(255, 232, 160, 0.14), transparent);
          animation: pp-shine 5.5s ease-in-out infinite;
        }
        .pp-shine { position: absolute; inset: 0; overflow: hidden; }

        /* Border glow shimmer on the cover frame */
        @keyframes pp-border-glow {
          0%, 100% { box-shadow: 0 0 6px 0 rgba(201, 168, 76, 0.2) inset; }
          50%      { box-shadow: 0 0 14px 1px rgba(201, 168, 76, 0.4) inset; }
        }
        .pp-border-glow { animation: pp-border-glow 4s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .passport-turn-next, .passport-turn-prev,
          .pp-float, .pp-breathe, .pp-hover-float, .pp-glow, .pp-twinkle,
          .pp-spin-slow, .pp-border-glow { animation: none; }
          .pp-shine::after { animation: none; display: none; }
          .pp-rise { animation: none; opacity: 1; }
          .pp-stamp { animation: none; opacity: 1; }
          .pp-pop { animation: none; transform: scale(1); }
        }
      `}</style>

      <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        {/* Booklet */}
        <div className="relative w-[340px] sm:w-[380px] h-[500px] sm:h-[540px]">
          {/* Stacked-pages depth effect */}
          <div className="absolute inset-0 translate-x-[5px] translate-y-[5px] rounded-2xl bg-[#E7E0D0] shadow-md" aria-hidden />
          <div className="absolute inset-0 translate-x-[2.5px] translate-y-[2.5px] rounded-2xl bg-[#F1EBDD] shadow" aria-hidden />
          {/* Current page — keyed so entrance animations replay on every flip */}
          <div
            key={page}
            className={`absolute inset-0 rounded-2xl shadow-2xl ${turning === 'next' ? 'passport-turn-next' : turning === 'prev' ? 'passport-turn-prev' : ''}`}
          >
            {pages[page]}
          </div>
          {/* Spine hint */}
          {page > 0 && (
            <div className="absolute left-0 top-0 bottom-0 w-[7px] rounded-l-2xl bg-gradient-to-r from-black/15 to-transparent pointer-events-none" aria-hidden />
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-gray-500 hover:text-gray-800 hover:scale-105 transition-all cursor-pointer z-10"
            aria-label="Close passport"
          >
            <X size={15} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => go('prev')}
            disabled={page === 0 || turning !== null}
            className="w-10 h-10 rounded-full bg-white/95 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-default cursor-pointer transition-all hover:scale-105"
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Dots */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Passport pages">
            {pages.map((_, i) => (
              <button
                key={i}
                onClick={() => { if (i !== page && turning === null) { setTurning(i > page ? 'next' : 'prev'); setPage(i); window.setTimeout(() => setTurning(null), 340); } }}
                className={`rounded-full transition-all cursor-pointer ${i === page ? 'w-5 h-2 bg-[#C9A84C]' : 'w-2 h-2 bg-white/50 hover:bg-white/80'}`}
                role="tab"
                aria-selected={i === page}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => go('next')}
            disabled={page === pages.length - 1 || turning !== null}
            className="w-10 h-10 rounded-full bg-white/95 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white disabled:opacity-30 disabled:cursor-default cursor-pointer transition-all hover:scale-105"
            aria-label="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <p className="text-[10px] text-white/50 font-semibold tracking-wide">Use ← → arrow keys to flip pages</p>
      </div>
    </div>
  );
}
