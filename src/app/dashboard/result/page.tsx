'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher, authFetch } from '@/lib/swr';
import {
  Award, Loader2, Search, Download, ChevronDown, ChevronUp,
  Users, Filter, X, CheckCircle2, AlertCircle, Lock, Unlock, BookOpen, Star,
  ChevronRight, ChevronLeft, School, GraduationCap, Send, Undo2,
} from 'lucide-react';
import ResultPassportV2, { type PassportV2Student } from '@/components/ResultPassportV2';
import { KOSH_CRITERIA, MAX_PER_CRITERION, VIDEO_MAX_SCORE, criterionLabel, type CriterionKey } from '@/lib/kosh';

interface VideoResultEntry {
  id: string;
  category: string | null;
  subCategory: string | null;
  slot: number;
  criteria: Record<CriterionKey, number> | null;
  totalScore: number | null;
  isEvaluated: boolean;
  isPublished: boolean;
  videoPercent: number | null;
  evaluatorName: string | null;
}

interface ExamQuestionEntry {
  questionNumber: number;
  pageNumber: number;
  questionText: string | null;
  questionType: string | null;
  maxMarks: number;
  aiMarks: number | null;
  aiConfidence: number | null;
  performanceLevel: string | null;
  manualPerformanceLevel: string | null;
  manualMarks: number | null;
  manualMarksDisplay: string | null;
  reviewedBy: string | null;
  score: number | null;
  percentage: number | null;
  aiKoshas: { kosha: string; earned: number; weight: number }[];
  manualKoshas: { kosha: string; earned: number; weight: number }[];
}

interface KoshBreakdownEntry {
  kosh: string;
  label: string;
  videoScore: number | null;
  videoMaxScore: number;
  grade: 'Beginner' | 'Progressing' | 'Proficient' | null;
  examPercent: number | null;
  videoPercent: number | null;
  combinedPercent: number | null;
}

interface StudentResult {
  studentKey: string;
  name: string;
  olympiadCode: string;
  className: string | null;
  schoolName: string | null;
  schoolId: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  source: 'web' | 'app';
  avatarUrl: string | null;
  videos: VideoResultEntry[];
  examSource: 'ai' | 'manual';
  examPercentage: number | null;
  examTotalScore: number | null;
  examMaxScore: number | null;
  examAiTotalScore: number | null;
  examAiMaxScore: number | null;
  examManualTotalScore: number | null;
  examManualMaxScore: number;
  examManualQuestionCount: number;
  examQuestions: ExamQuestionEntry[];
  videoScoreTotal: number;
  videoMaxScore: number;
  koshBreakdown: KoshBreakdownEntry[];
  holisticPercent: number | null;
  status: 'Complete' | 'Incomplete';
}

function StatusBadge({ status }: { status: string }) {
  const isComplete = status === 'Complete';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
      isComplete ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
    }`}>
      {isComplete ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {status}
    </span>
  );
}

function percentBandClass(pct: number) {
  if (pct >= 80) return 'text-emerald-700';
  if (pct >= 55) return 'text-[#004f9f]';
  if (pct >= 30) return 'text-amber-700';
  return 'text-red-600';
}

// Colors for the scanner's own per-question performance_level label — set by
// the scanner team, independent of the raw marks percentage shown alongside it.
function performanceLevelClass(level: string) {
  const key = level.trim().toLowerCase();
  if (key === 'proficient') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (key === 'progressing') return 'bg-[#EBF3FC] text-[#004f9f] border-[#BFD8F5]';
  if (key === 'beginner') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (key === 'did not attempt') return 'bg-gray-100 text-gray-500 border-gray-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}

// A fieldset/legend-style section: the title sits as a pill straddling the
// top border of a bordered container, like a native <fieldset><legend>.
function LegendSection({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative border border-gray-200 rounded-2xl bg-white/60 pt-3.5 pb-4 px-4">
      <div className="absolute -top-3 left-3 flex items-center gap-2 bg-amber-50/30 px-2">
        <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 shadow-sm text-[11px] font-bold text-gray-600 uppercase tracking-wide">
          {title}
        </span>
      </div>
      {right && <div className="absolute -top-3 right-3 bg-amber-50/30 px-2">{right}</div>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

// 5-star rating where each star is worth 20% — fractional stars (e.g. 90% =
// 4.5 stars) render as a partial fill via clip-path, not rounded to a whole star.
function StarRating({ percent }: { percent: number }) {
  const starsExact = (Math.max(0, Math.min(100, percent)) / 100) * 5;
  return (
    <div className="flex items-center gap-0.5" aria-label={`${percent}% — ${(Math.round(starsExact * 2) / 2).toFixed(1)} of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, starsExact - i)); // 0..1 fill for this star
        return (
          <span key={i} className="relative inline-block w-3.5 h-3.5">
            <Star size={14} className="absolute inset-0 text-gray-200" fill="currentColor" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={14} className="text-amber-400" fill="currentColor" />
            </span>
          </span>
        );
      })}
    </div>
  );
}

function gradeBadgeClass(grade: string) {
  if (grade === 'Proficient') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (grade === 'Progressing') return 'bg-blue-50 border-blue-200 text-[#004f9f]';
  return 'bg-amber-50 border-amber-200 text-amber-700';
}

// The student rows (with their expandable detail and passport button) for one class.
function StudentsTable({
  list, expandedRow, setExpandedRow, setPassportFor,
}: {
  list: StudentResult[];
  expandedRow: string | null;
  setExpandedRow: (key: string | null) => void;
  setPassportFor: (row: StudentResult) => void;
}) {
  return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="py-3 px-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="py-3 px-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                <th className="py-3 px-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="py-3 px-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="py-3 px-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">School</th>
                <th className="py-3 px-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Exam (AI)</th>
                <th className="py-3 px-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Exam (Manual)</th>
                <th className="py-3 px-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Videos</th>
                <th className="py-3 px-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Holistic</th>
                <th className="py-3 px-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-3 px-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Passport</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={11} className="py-16 text-center text-gray-400 font-medium">No students found.</td></tr>
              )}
              {list.map((row, idx) => {
                const isExpanded = expandedRow === row.studentKey;
                return (
                  <Fragment key={row.studentKey}>
                    <tr
                      onClick={() => setExpandedRow(isExpanded ? null : row.studentKey)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${isExpanded ? 'bg-amber-50/60' : 'hover:bg-gray-50'}`}>
                      <td className="py-3 px-2">
                        {isExpanded ? <ChevronUp size={16} className="text-amber-500" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </td>
                      <td className="py-3 px-2 text-gray-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0">
                            {row.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <p className="font-bold text-gray-900 text-[13px] truncate max-w-[120px]">{row.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2 font-mono text-xs text-gray-600 font-semibold">{row.olympiadCode}</td>
                      <td className="py-3 px-2 text-gray-600 text-xs max-w-[110px] truncate" title={row.schoolName || '-'}>{row.schoolName || '-'}</td>
                      <td className="py-3 px-2 text-center font-bold text-gray-700 text-xs whitespace-nowrap">
                        {row.examAiTotalScore !== null ? (
                          <>
                            {row.examAiTotalScore}<span className="text-gray-400 font-semibold">/{row.examAiMaxScore}</span>
                            {row.examAiMaxScore ? <span className="block text-[10px] text-gray-400 font-semibold">{Math.round((row.examAiTotalScore / row.examAiMaxScore) * 1000) / 10}%</span> : null}
                          </>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-gray-700 text-xs whitespace-nowrap">
                        {row.examManualTotalScore !== null ? (
                          <>
                            {row.examManualTotalScore}<span className="text-gray-400 font-semibold">/{row.examManualMaxScore}</span>
                            {row.examManualMaxScore ? <span className="block text-[10px] text-gray-400 font-semibold">{Math.round((row.examManualTotalScore / row.examManualMaxScore) * 1000) / 10}%</span> : null}
                            {row.examManualQuestionCount < row.examQuestions.length && (
                              <span className="block text-[9px] text-amber-500 font-semibold">{row.examManualQuestionCount}/{row.examQuestions.length} reviewed</span>
                            )}
                          </>
                        ) : <span className="text-gray-300 font-semibold text-[11px]">Not reviewed</span>}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-gray-700 text-xs whitespace-nowrap">
                        {row.videoScoreTotal}<span className="text-gray-400 font-semibold">/{row.videoMaxScore}</span>
                        {row.videoMaxScore > 0 && (
                          <span className="block text-[10px] text-gray-400 font-semibold">
                            {Math.round((row.videoScoreTotal / row.videoMaxScore) * 1000) / 10}%
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {row.holisticPercent !== null ? (
                          <span className={`text-base font-black ${percentBandClass(row.holisticPercent)}`}>{row.holisticPercent}%</span>
                        ) : (
                          <span className="text-sm text-gray-400 font-semibold">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center"><StatusBadge status={row.status} /></td>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={e => { e.stopPropagation(); setPassportFor(row); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-[#06013E] text-[#F5E9C8] hover:bg-[#0a0258] transition-colors cursor-pointer shadow-sm whitespace-nowrap"
                          aria-label={`Open result passport for ${row.name}`}
                        >
                          <BookOpen size={12} /> Open
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={11} className="bg-amber-50/30 border-b border-amber-100 px-6 py-5">
                          <div className="space-y-5">
                            <LegendSection
                              title={`Olympiad Checker (Scanned Exam Sheet) — ${row.examQuestions.length} Questions`}
                              right={
                                <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 shadow-sm text-[11px] font-bold text-gray-700">
                                  {row.examTotalScore !== null ? row.examTotalScore : '—'}
                                  <span className="text-gray-400 font-semibold">/{row.examMaxScore ?? '—'}</span>
                                  {row.examPercentage !== null && <span className="ml-1.5 text-gray-400 font-semibold">{row.examPercentage}%</span>}
                                </span>
                              }
                            >
                              {row.examQuestions.length > 0 ? (
                                <div className="overflow-x-auto -mx-1">
                                  <table className="w-full text-xs border-collapse min-w-[920px]">
                                    <thead>
                                      <tr className="border-b border-gray-200">
                                        <th className="text-left font-bold text-gray-400 uppercase tracking-wide text-[10px] py-2 px-2 w-8">#</th>
                                        <th className="text-left font-bold text-gray-400 uppercase tracking-wide text-[10px] py-2 px-2">Question</th>
                                        <th className="text-center font-bold text-gray-400 uppercase tracking-wide text-[10px] py-2 px-2 w-14">Max</th>
                                        <th className="text-center font-bold text-gray-400 uppercase tracking-wide text-[10px] py-2 px-2 w-24">AI Marks</th>
                                        <th className="text-center font-bold text-gray-400 uppercase tracking-wide text-[10px] py-2 px-2 w-28">AI Level</th>
                                        <th className="text-center font-bold text-gray-400 uppercase tracking-wide text-[10px] py-2 px-2 w-24">Manual Marks</th>
                                        <th className="text-center font-bold text-gray-400 uppercase tracking-wide text-[10px] py-2 px-2 w-28">Manual Level</th>
                                        <th className="text-left font-bold text-gray-400 uppercase tracking-wide text-[10px] py-2 px-2">Kosh (AI)</th>
                                        <th className="text-left font-bold text-gray-400 uppercase tracking-wide text-[10px] py-2 px-2">Kosh (Manual)</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.examQuestions.map(q => (
                                        <tr key={q.questionNumber} className="border-b border-gray-100 align-top hover:bg-gray-50/60">
                                          <td className="py-2.5 px-2 text-gray-400 font-semibold">{q.questionNumber}</td>
                                          <td className="py-2.5 px-2">
                                            <p className="font-semibold text-gray-800">{q.questionText || `Question ${q.questionNumber}`}</p>
                                            {q.questionType && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{q.questionType}</p>}
                                          </td>
                                          <td className="py-2.5 px-2 text-center font-bold text-gray-700">{q.maxMarks}</td>
                                          <td className="py-2.5 px-2 text-center">
                                            {q.aiMarks !== null ? (
                                              <>
                                                <span className={`font-black ${percentBandClass(q.maxMarks ? (q.aiMarks / q.maxMarks) * 100 : 0)}`}>
                                                  {Number.isInteger(q.aiMarks) ? q.aiMarks : q.aiMarks.toFixed(2)}
                                                </span>
                                                {q.aiConfidence !== null && (
                                                  <p className="text-[9px] text-gray-400 mt-0.5">{Math.round(q.aiConfidence * 100)}% conf.</p>
                                                )}
                                              </>
                                            ) : <span className="text-gray-300">—</span>}
                                          </td>
                                          <td className="py-2.5 px-2 text-center">
                                            {q.performanceLevel ? (
                                              <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${performanceLevelClass(q.performanceLevel)}`}>
                                                {q.performanceLevel}
                                              </span>
                                            ) : <span className="text-gray-300">—</span>}
                                          </td>
                                          <td className="py-2.5 px-2 text-center">
                                            {q.manualMarks !== null ? (
                                              <span className="font-black text-gray-800">{q.manualMarksDisplay ?? q.manualMarks}</span>
                                            ) : <span className="text-gray-300">—</span>}
                                          </td>
                                          <td className="py-2.5 px-2 text-center">
                                            {q.manualPerformanceLevel ? (
                                              <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${performanceLevelClass(q.manualPerformanceLevel)}`}>
                                                {q.manualPerformanceLevel}
                                              </span>
                                            ) : <span className="text-gray-300">—</span>}
                                          </td>
                                          <td className="py-2.5 px-2">
                                            <div className="flex flex-wrap gap-1">
                                              {q.aiKoshas.map(k => (
                                                <span key={k.kosha} className="inline-flex flex-col items-start px-2 py-1 rounded-lg border border-amber-200 bg-amber-50/70">
                                                  <span className="text-[10px] font-bold text-amber-800">{k.kosha}</span>
                                                  <span className="text-[9px] text-amber-600 font-semibold">{k.earned}/{k.weight} marks · {k.weight ? Math.round((k.earned / k.weight) * 100) : 0}%</span>
                                                </span>
                                              ))}
                                              {q.aiKoshas.length === 0 && <span className="text-[10px] text-gray-300">—</span>}
                                            </div>
                                          </td>
                                          <td className="py-2.5 px-2">
                                            <div className="flex flex-wrap gap-1">
                                              {q.manualKoshas.map(k => (
                                                <span key={k.kosha} className="inline-flex flex-col items-start px-2 py-1 rounded-lg border border-blue-200 bg-blue-50/70">
                                                  <span className="text-[10px] font-bold text-[#004f9f]">{k.kosha}</span>
                                                  <span className="text-[9px] text-[#0a6bc4] font-semibold">{k.earned}/{k.weight} marks · {k.weight ? Math.round((k.earned / k.weight) * 100) : 0}%</span>
                                                </span>
                                              ))}
                                              {q.manualKoshas.length === 0 && <span className="text-[10px] text-gray-300">—</span>}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400">No written-round data yet — pending exam scan.</p>
                              )}
                            </LegendSection>

                            <LegendSection
                              title="Talent Round — Video Evaluation"
                              right={
                                <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 shadow-sm text-[11px] font-bold text-gray-700">
                                  {row.videoScoreTotal}<span className="text-gray-400 font-semibold">/{row.videoMaxScore}</span>
                                </span>
                              }
                            >
                              <div className="grid gap-3">
                              {row.videos.map((vid, vi) => (
                                <div key={vid.id} className={`bg-white rounded-xl border p-4 ${
                                  vid.isPublished ? 'border-emerald-200' : vid.isEvaluated ? 'border-amber-200' : 'border-gray-200'
                                }`}>
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-gray-700">Video {vi + 1}</span>
                                        {vid.category && <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{vid.category}</span>}
                                        {vid.subCategory && <span className="text-[10px] font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{vid.subCategory}</span>}
                                      </div>
                                      <p className="text-[10px] text-gray-400">
                                        {vid.evaluatorName ? `Evaluated by ${vid.evaluatorName}` : 'Not yet evaluated'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                      {vid.isEvaluated && (
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                          vid.isPublished ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                                        }`}>
                                          {vid.isPublished ? <Lock size={10} /> : <Unlock size={10} />}
                                          {vid.isPublished ? 'Published' : 'Draft'}
                                        </span>
                                      )}
                                      <div className="flex flex-col items-center min-w-[60px]">
                                        <span className="text-xl font-black text-gray-900">{vid.videoPercent !== null ? `${vid.videoPercent}%` : '-'}</span>
                                        {vid.totalScore !== null && (
                                          <span className="text-[10px] font-bold text-gray-500">{vid.totalScore}<span className="text-gray-400">/{VIDEO_MAX_SCORE}</span></span>
                                        )}
                                        <span className="text-[9px] text-gray-400 font-bold uppercase">video score</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Per-criterion marks, each mapped to its kosha — mirrors the exam side's per-question/per-kosha detail */}
                                  {vid.criteria && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {KOSH_CRITERIA.map(c => {
                                        const score = vid.criteria![c.key];
                                        const pct = Math.round((score / MAX_PER_CRITERION) * 100);
                                        return (
                                          <div key={c.key} className="flex items-center justify-between gap-2 bg-gray-50/70 rounded-lg px-2.5 py-1.5">
                                            <div className="min-w-0">
                                              <p className="text-[10.5px] font-bold text-gray-700 truncate">{criterionLabel(c.key, vid.slot)}</p>
                                              <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide flex items-center gap-1">
                                                <span>{c.kosh.charAt(0) + c.kosh.slice(1).toLowerCase()} Kosh</span>
                                                <span className={percentBandClass(pct)}>→</span>
                                                <span className={`font-bold ${percentBandClass(pct)}`}>{pct}%</span>
                                              </p>
                                            </div>
                                            <span className={`text-xs font-black flex-shrink-0 ${percentBandClass(pct)}`}>{score}<span className="text-gray-400 font-bold">/{MAX_PER_CRITERION}</span></span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                              </div>
                            </LegendSection>

                            <LegendSection title="Kosh Breakdown">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {row.koshBreakdown.map(k => (
                                  <div key={k.kosh} className="bg-white rounded-xl border border-gray-200 p-3.5">
                                    <div className="flex items-center justify-between mb-2.5">
                                      <span className="text-xs font-bold text-gray-700">{k.label}</span>
                                      {k.grade && (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${gradeBadgeClass(k.grade)}`}>{k.grade}</span>
                                      )}
                                    </div>
                                    {/* Overall % — the combined exam + video weightage for this kosha */}
                                    <div className="bg-gray-50/70 rounded-lg px-3 py-2.5 mb-2.5">
                                      <span className={`block text-2xl font-black leading-none ${k.combinedPercent !== null ? percentBandClass(k.combinedPercent) : 'text-gray-400'}`}>
                                        {k.combinedPercent !== null ? `${k.combinedPercent}%` : '—'}
                                      </span>
                                      <span className="text-[9px] text-gray-400 font-bold uppercase mt-1 block">Overall Weightage</span>
                                      {k.combinedPercent !== null && (
                                        <div className="mt-1.5"><StarRating percent={k.combinedPercent} /></div>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-gray-500 font-semibold border-t border-gray-100 pt-2">
                                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#004f9f]" />Exam: {k.examPercent !== null ? `${k.examPercent}%` : '—'}</span>
                                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Videos: {k.videoPercent !== null ? `${k.videoPercent}%` : '—'}</span>
                                    </div>
                                  </div>
                                ))}
                                {row.koshBreakdown.length === 0 && (
                                  <p className="text-xs text-gray-400 col-span-full">No kosh data yet — pending exam scan and/or video evaluation.</p>
                                )}
                                {row.koshBreakdown.length === 5 && (
                                  <div className="hidden lg:flex items-end justify-center">
                                    {/* mix-blend-mode blends the image's own white backdrop into the
                                        card's near-white ground, so it reads as a cutout, not a tile. */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/Binku & Binki (2).png" alt="Binku and Binki mascots" className="h-40 w-auto object-contain [mix-blend-mode:multiply]" />
                                  </div>
                                )}
                              </div>
                            </LegendSection>

                            <div className="flex items-center justify-end gap-4 pt-2 border-t border-amber-100 text-xs font-semibold text-gray-600">
                              <span>Exam: {row.examPercentage !== null ? `${row.examPercentage}%` : 'Not scanned'}</span>
                              <span>Videos: {row.videoScoreTotal}/{row.videoMaxScore}</span>
                              <span className="text-sm font-black text-gray-900">Holistic: {row.holisticPercent !== null ? `${row.holisticPercent}%` : '—'}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
  );
}

interface ClassGroup { name: string; students: StudentResult[]; complete: number; avg: number | null }

// One row of the school list (the API returns just one page of these).
interface SchoolSummary {
  schoolId: string; name: string; city: string | null; district: string | null; state: string | null;
  students: number; classes: number; complete: number; incomplete: number;
  passportReleasedAt: string | null;
}
interface SchoolsResponse {
  schools: SchoolSummary[]; total: number; page: number; pageSize: number; totalPages: number;
  totals: { schools: number; students: number; complete: number; incomplete: number };
  states: string[];
}

const average = (vals: (number | null)[]) => {
  const nums = vals.filter((v): v is number => v !== null);
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null;
};

// Classes in natural order (Class 2 before Class 10).
function groupClasses(list: StudentResult[]): ClassGroup[] {
  const classes = new Map<string, StudentResult[]>();
  for (const r of list) {
    const cn = r.className || 'No class';
    if (!classes.has(cn)) classes.set(cn, []);
    classes.get(cn)!.push(r);
  }
  return Array.from(classes.entries())
    .sort((x, y) => x[0].localeCompare(y[0], undefined, { numeric: true, sensitivity: 'base' }))
    .map(([name, students]) => ({
      name, students,
      complete: students.filter(s => s.status === 'Complete').length,
      avg: average(students.map(s => s.holisticPercent)),
    }));
}

function Stat({ label, value, tone = 'text-gray-900' }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="text-center min-w-[58px]">
      <p className={`text-base font-black leading-tight ${tone}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}

// The classes and students of ONE school. Fetched only when the school is opened,
// so the page never loads more than the schools you actually look at.
function SchoolStudents({
  schoolId, examSource, q, status, expandedRow, setExpandedRow, setPassportFor, openClasses, toggleClass,
}: {
  schoolId: string; examSource: 'ai' | 'manual'; q: string; status: string;
  expandedRow: string | null; setExpandedRow: (key: string | null) => void;
  setPassportFor: (row: StudentResult) => void;
  openClasses: Set<string>; toggleClass: (key: string) => void;
}) {
  const params = new URLSearchParams({ schoolId, examSource });
  if (q) params.set('q', q);
  if (status !== 'All') params.set('status', status);
  const { data, error, isLoading, mutate } = useSWR<StudentResult[]>(`/api/result/overview?${params}`, fetcher);
  const classes = useMemo(() => groupClasses(Array.isArray(data) ? data : []), [data]);

  if (isLoading) {
    return (
      <div className="border-t border-gray-100 bg-gray-50/50 py-8 flex items-center justify-center gap-2 text-sm text-gray-400 font-medium">
        <Loader2 className="w-4 h-4 animate-spin text-[#009846]" /> Loading students…
      </div>
    );
  }
  if (error) {
    return (
      <div className="border-t border-gray-100 bg-gray-50/50 py-6 text-center text-sm text-red-500 font-medium">
        Could not load this school.{' '}
        <button onClick={() => mutate()} className="font-bold underline cursor-pointer">Retry</button>
      </div>
    );
  }
  if (classes.length === 0) {
    return <div className="border-t border-gray-100 bg-gray-50/50 py-6 text-center text-sm text-gray-400 font-medium">No students match.</div>;
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/50 p-3 space-y-2">
      {classes.map(cg => {
        const ck = `${schoolId}|${cg.name}`;
        const classOpen = openClasses.has(ck);
        return (
          <div key={ck} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleClass(ck)}
              aria-expanded={classOpen}
              className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors cursor-pointer ${classOpen ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}
            >
              <ChevronRight size={16} className={`flex-shrink-0 transition-transform ${classOpen ? 'rotate-90 text-[#004f9f]' : 'text-gray-400'}`} />
              <div className="w-8 h-8 rounded-lg bg-[#EBF3FC] text-[#004f9f] flex items-center justify-center flex-shrink-0">
                <GraduationCap size={16} />
              </div>
              <p className="font-bold text-gray-800 text-[13px] flex-1 min-w-0 truncate">{cg.name}</p>
              <div className="flex items-center gap-4 flex-shrink-0">
                <Stat label="Students" value={cg.students.length} />
                <span className="hidden sm:block"><Stat label="Complete" value={cg.complete} tone="text-emerald-700" /></span>
                <span className="hidden sm:block"><Stat label="Incomplete" value={cg.students.length - cg.complete} tone="text-amber-700" /></span>
                <Stat label="Avg" value={cg.avg !== null ? `${cg.avg}%` : '—'} tone={cg.avg !== null ? percentBandClass(cg.avg) : 'text-gray-400'} />
              </div>
            </button>
            {classOpen && (
              <div className="border-t border-gray-100">
                <StudentsTable list={cg.students} expandedRow={expandedRow} setExpandedRow={setExpandedRow} setPassportFor={setPassportFor} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ResultPage() {
  // Which set of exam marks drives Holistic %, Kosh Breakdown, and the Exam
  // column — AI's own grading, or the human reviewer's. Manual matches what
  // the scanner itself currently reports as the "official" score.
  const [examSource, setExamSource] = useState<'ai' | 'manual'>('manual');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [passportFor, setPassportFor] = useState<StudentResult | null>(null);
  const [openSchools, setOpenSchools] = useState<Set<string>>(new Set());
  const [openClasses, setOpenClasses] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  // Search is sent to the server, so wait for a pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 350);
    return () => clearTimeout(t);
  }, [search]);
  // Back to page 1 whenever the list itself changes.
  useEffect(() => { setPage(1); }, [debouncedSearch, filterState, filterStatus, pageSize]);

  // ONE page of schools per request — the server does the filtering and counting.
  const listParams = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (debouncedSearch) listParams.set('q', debouncedSearch);
  if (filterState !== 'All') listParams.set('state', filterState);
  if (filterStatus !== 'All') listParams.set('status', filterStatus);
  const { data, error, isLoading: loading, isValidating, mutate: mutateSchools } = useSWR<SchoolsResponse>(
    `/api/result/overview/schools?${listParams}`, fetcher, { keepPreviousData: true },
  );

  const states = useMemo(() => ['All', ...(data?.states ?? [])], [data?.states]);
  const schools = data?.schools ?? [];
  const totals = data?.totals ?? { schools: 0, students: 0, complete: 0, incomplete: 0 };
  const totalPages = data?.totalPages ?? 1;
  const safePage = Math.min(page, totalPages);

  const activeFilterCount = [filterState, filterStatus].filter(v => v !== 'All').length;
  // Release (or withdraw) a school's student passports: the school's own
  // "Student Passports" page shows nothing until this is done.
  const [releasing, setReleasing] = useState<string | null>(null);
  const togglePassportRelease = async (sc: SchoolSummary) => {
    const releasing_ = !sc.passportReleasedAt;
    const ok = window.confirm(releasing_
      ? `Release passports to ${sc.name}?

${sc.complete} completed passport${sc.complete === 1 ? '' : 's'} will become visible to the school (${sc.incomplete} not ready yet).`
      : `Withdraw passports from ${sc.name}? The school will no longer be able to see them.`);
    if (!ok) return;
    setReleasing(sc.schoolId);
    try {
      const res = await authFetch('/api/result/passport-release', {
        method: releasing_ ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: sc.schoolId }),
      });
      if (!res.ok) throw new Error();
      await mutateSchools();
    } catch {
      alert(releasing_ ? 'Could not release passports. Please try again.' : 'Could not withdraw passports. Please try again.');
    } finally {
      setReleasing(null);
    }
  };

  const clearFilters = () => { setFilterState('All'); setFilterStatus('All'); setSearch(''); };

  const pageNumbers = useMemo(() => {
    const nums: (number | '…')[] = [];
    for (let n = 1; n <= totalPages; n++) {
      if (n === 1 || n === totalPages || Math.abs(n - safePage) <= 1) nums.push(n);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    return nums;
  }, [totalPages, safePage]);

  // The CSV is the one place that still needs every student, so it loads them on click
  // (the page itself never does) and applies the same filters on this side.
  const downloadCSV = async () => {
    setExporting(true);
    try {
      const all: StudentResult[] = await fetcher(`/api/result/overview?examSource=${examSource}`);
      const filtered = all.filter(r => {
        if (filterState !== 'All' && r.state !== filterState) return false;
        if (filterStatus !== 'All' && r.status !== filterStatus) return false;
        if (debouncedSearch) {
          return r.name.toLowerCase().includes(debouncedSearch) || r.olympiadCode.toLowerCase().includes(debouncedSearch)
            || (r.schoolName || '').toLowerCase().includes(debouncedSearch);
        }
        return true;
      });
      const koshLabels = Array.from(new Set(filtered.flatMap(r => r.koshBreakdown.map(k => k.label))));
      const header = [
        'Name', 'Olympiad Code', 'Class', 'School', 'Exam %', 'Video Score',
        ...koshLabels.flatMap(l => [`${l} Marks`, `${l} Grade`, `${l} Overall %`]),
        'Holistic %', 'Status',
      ];
      const csvRows = filtered.map(r => {
        const koshByLabel = new Map(r.koshBreakdown.map(k => [k.label, k]));
        return [
          r.name, r.olympiadCode, r.className || '-', r.schoolName || '-',
          r.examPercentage ?? '-', `${r.videoScoreTotal}/${r.videoMaxScore}`,
          ...koshLabels.flatMap(l => {
            const k = koshByLabel.get(l);
            return [
              k && k.videoScore !== null ? `${k.videoScore}/${k.videoMaxScore}` : '-',
              k?.grade ?? '-',
              k?.combinedPercent ?? '-',
            ];
          }),
          r.holisticPercent ?? '-', r.status,
        ];
      });
      const csv = [header, ...csvRows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `holistic-progress-passport-${new Date().toISOString().split('T')[0]}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#009846]" />
          <p className="text-gray-500 font-medium">Loading schools…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200">
            <Award className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Holistic Progress Passport</h1>
            <p className="text-sm text-gray-400">Each kosh's % = average of exam performance and video evaluation, where both exist</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-sm p-1">
            <span className="pl-2 pr-1 text-xs font-bold text-gray-400 uppercase tracking-wide">Exam Score:</span>
            {(['manual', 'ai'] as const).map(s => (
              <button
                key={s}
                onClick={() => setExamSource(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  examSource === s ? 'bg-[#06013E] text-[#F5E9C8] shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {s === 'manual' ? 'Manual' : 'AI'}
              </button>
            ))}
          </div>
          <button onClick={downloadCSV} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all hover:shadow-md active:scale-95 disabled:opacity-60">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Schools', value: totals.schools, icon: <School size={18} />, color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-200' },
          { label: 'Total Students', value: totals.students, icon: <Users size={18} />, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-200' },
          { label: 'Complete',       value: totals.complete, icon: <CheckCircle2 size={18} />, color: 'from-emerald-500 to-green-600', shadow: 'shadow-emerald-200' },
          { label: 'Incomplete',     value: totals.incomplete, icon: <AlertCircle size={18} />, color: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${c.color} ${c.shadow} shadow-md flex items-center justify-center text-white`}>{c.icon}</div>
              <span className="text-xs text-gray-400 font-semibold">{c.label}</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-700">Filters</span>
          {isValidating && <Loader2 size={14} className="animate-spin text-gray-300" />}
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="ml-2 flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors">
              <X size={14} /> Clear ({activeFilterCount})
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input type="text" placeholder="Search school, student name or code…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none" />
          </div>
          <select value={filterState} onChange={e => setFilterState(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-amber-300 outline-none">
            {states.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-amber-300 outline-none">
            <option value="All">All Status</option>
            <option value="Complete">Complete</option>
            <option value="Incomplete">Incomplete</option>
          </select>
        </div>
      </div>

      <div className={`space-y-3 transition-opacity ${isValidating ? 'opacity-70' : ''}`}>
        {error && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm py-10 text-center text-red-500 font-medium">Could not load schools. Please refresh.</div>
        )}
        {!error && schools.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400 font-medium">No schools found.</div>
        )}
        {schools.map(sc => {
          const schoolOpen = openSchools.has(sc.schoolId);
          return (
            <div key={sc.schoolId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className={`flex items-center ${schoolOpen ? 'bg-amber-50/60' : 'hover:bg-gray-50'} transition-colors`}>
              <button
                type="button"
                onClick={() => toggleIn(setOpenSchools, sc.schoolId)}
                aria-expanded={schoolOpen}
                className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
              >
                <ChevronRight size={18} className={`flex-shrink-0 transition-transform ${schoolOpen ? 'rotate-90 text-amber-500' : 'text-gray-400'}`} />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-200">
                  <School size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-gray-900 text-[14px] truncate">{sc.name}</p>
                  <p className="text-[11px] text-gray-400 font-medium truncate">
                    {[sc.schoolId, sc.city, sc.district, sc.state].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="sm:hidden mt-0.5 text-[11px] font-semibold text-gray-500">
                    {sc.classes} classes · {sc.students} students · {sc.complete} complete
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                  <Stat label="Classes" value={sc.classes} />
                  <Stat label="Students" value={sc.students} />
                  <Stat label="Complete" value={sc.complete} tone="text-emerald-700" />
                  <Stat label="Incomplete" value={sc.incomplete} tone="text-amber-700" />
                </div>
              </button>
              <div className="flex-shrink-0 pr-4 flex flex-col items-end gap-0.5">
                <button
                  type="button"
                  onClick={() => togglePassportRelease(sc)}
                  disabled={releasing === sc.schoolId || (!sc.passportReleasedAt && sc.complete === 0)}
                  title={!sc.passportReleasedAt && sc.complete === 0 ? 'No completed passports to release yet' : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                    sc.passportReleasedAt
                      ? 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      : 'bg-[#06013E] text-[#F5E9C8] hover:bg-[#0a0258] shadow-sm'
                  }`}
                >
                  {releasing === sc.schoolId ? <Loader2 size={12} className="animate-spin" /> : sc.passportReleasedAt ? <Undo2 size={12} /> : <Send size={12} />}
                  {sc.passportReleasedAt ? 'Withdraw' : 'Release to school'}
                </button>
                {sc.passportReleasedAt && (
                  <span className="text-[10px] font-semibold text-emerald-700">
                    Released {new Date(sc.passportReleasedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              </div>

              {schoolOpen && (
                <SchoolStudents
                  schoolId={sc.schoolId}
                  examSource={examSource}
                  q={debouncedSearch}
                  status={filterStatus}
                  expandedRow={expandedRow}
                  setExpandedRow={setExpandedRow}
                  setPassportFor={setPassportFor}
                  openClasses={openClasses}
                  toggleClass={key => toggleIn(setOpenClasses, key)}
                />
              )}
            </div>
          );
        })}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <p className="text-xs text-gray-400 font-medium">
            Schools {schools.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{(safePage - 1) * pageSize + schools.length} of {(data?.total ?? 0).toLocaleString()}
            {' · '}{totals.students.toLocaleString()} students
          </p>
          {schools.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
                Per page
                <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white outline-none focus:ring-2 focus:ring-amber-300">
                  {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <nav aria-label="School pages" className="flex items-center gap-1">
                <button onClick={() => setPage(safePage - 1)} disabled={safePage <= 1} aria-label="Previous page"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  <ChevronLeft size={15} />
                </button>
                {pageNumbers.map((n, i) => n === '…' ? (
                  <span key={`gap-${i}`} className="px-1 text-xs text-gray-400">…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)} aria-current={n === safePage ? 'page' : undefined}
                    className={`min-w-8 h-8 px-2 rounded-lg border text-xs font-bold cursor-pointer ${n === safePage ? 'bg-[#06013E] text-[#F5E9C8] border-[#06013E]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {n}
                  </button>
                ))}
                <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages} aria-label="Next page"
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  <ChevronRight size={15} />
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Result Passport booklet */}
      {passportFor && (
        <ResultPassportV2 student={passportFor as PassportV2Student} onClose={() => setPassportFor(null)} />
      )}
    </div>
  );
}
