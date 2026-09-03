'use client';

import { Fragment, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  Award, Loader2, Search, Download, ChevronDown, ChevronUp,
  Users, Filter, X, CheckCircle2, AlertCircle, Lock, Unlock, BookOpen, Star,
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

export default function ResultPage() {
  // Which set of exam marks drives Holistic %, Kosh Breakdown, and the Exam
  // column — AI's own grading, or the human reviewer's. Manual matches what
  // the scanner itself currently reports as the "official" score.
  const [examSource, setExamSource] = useState<'ai' | 'manual'>('manual');
  const { data, isLoading: loading } = useSWR<StudentResult[]>(`/api/result/overview?examSource=${examSource}`, fetcher);
  const rows: StudentResult[] = Array.isArray(data) ? data : [];

  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterSchool, setFilterSchool] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [passportFor, setPassportFor] = useState<StudentResult | null>(null);

  const states = useMemo(() => ['All', ...Array.from(new Set(rows.map(r => r.state).filter(Boolean) as string[])).sort()], [rows]);
  const schools = useMemo(() => {
    const scoped = filterState === 'All' ? rows : rows.filter(r => r.state === filterState);
    const unique = Array.from(new Map(scoped.map(r => [r.schoolId, r.schoolName])).entries()).filter(([id]) => id)
      .sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));
    return [['All', 'All Schools'], ...unique] as [string, string][];
  }, [rows, filterState]);

  const activeFilterCount = [filterState, filterSchool, filterStatus].filter(v => v !== 'All').length;
  const clearFilters = () => { setFilterState('All'); setFilterSchool('All'); setFilterStatus('All'); setSearch(''); };
  const handleStateChange = (value: string) => {
    setFilterState(value);
    setFilterSchool('All');
  };

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterState !== 'All' && r.state !== filterState) return false;
      if (filterSchool !== 'All' && r.schoolId !== filterSchool) return false;
      if (filterStatus !== 'All' && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.olympiadCode.toLowerCase().includes(q) || (r.schoolName || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, search, filterState, filterSchool, filterStatus]);

  const totalStudents = filtered.length;
  const totalComplete = filtered.filter(r => r.status === 'Complete').length;
  const totalIncomplete = totalStudents - totalComplete;

  const downloadCSV = () => {
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#009846]" />
          <p className="text-gray-500 font-medium">Loading results…</p>
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
          <button onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all hover:shadow-md active:scale-95">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Students', value: totalStudents, icon: <Users size={18} />, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-200' },
          { label: 'Complete',       value: totalComplete, icon: <CheckCircle2 size={18} />, color: 'from-emerald-500 to-green-600', shadow: 'shadow-emerald-200' },
          { label: 'Incomplete',     value: totalIncomplete, icon: <AlertCircle size={18} />, color: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200' },
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
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="ml-2 flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors">
              <X size={14} /> Clear ({activeFilterCount})
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input type="text" placeholder="Search name/code…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none" />
          </div>
          <select value={filterState} onChange={e => handleStateChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-amber-300 outline-none">
            {states.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
          </select>
          <select value={filterSchool} onChange={e => setFilterSchool(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-amber-300 outline-none">
            {schools.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-amber-300 outline-none">
            <option value="All">All Status</option>
            <option value="Complete">Complete</option>
            <option value="Incomplete">Incomplete</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="py-16 text-center text-gray-400 font-medium">No students found.</td></tr>
              )}
              {filtered.map((row, idx) => {
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
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400 font-medium">
          Showing {filtered.length} of {rows.length} students
        </div>
      </div>

      {/* Result Passport booklet */}
      {passportFor && (
        <ResultPassportV2 student={passportFor as PassportV2Student} onClose={() => setPassportFor(null)} />
      )}
    </div>
  );
}
