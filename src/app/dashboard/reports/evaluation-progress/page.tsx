'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  ClipboardCheck, Loader2, Search, Download, ChevronDown, ChevronUp,
  Users, Building2, Filter, X, CheckCircle2, Clock, Video, Play,
  AlertCircle, BarChart2, Pencil
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */

interface EvaluationDetail {
  totalScore: number;
  confidenceScore: number;
  creativityScore: number;
  techniqueScore: number;
  presentationScore: number;
  remarks: string | null;
  evaluatorName: string;
  evaluatedAt: string;
}

interface VideoEntry {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  category: string | null;
  subCategory: string | null;
  createdAt: string;
  isEvaluated: boolean;
  evaluation: EvaluationDetail | null;
}

interface StudentProgress {
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
  totalVideos: number;
  evaluatedVideos: number;
  pendingVideos: number;
  status: 'Completed' | 'In Progress' | 'Not Started';
  videos: VideoEntry[];
}

/* ── Status Badge ─────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    Completed:     { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle2 size={13} /> },
    'In Progress': { bg: 'bg-amber-50 border-amber-200',    text: 'text-amber-700',   icon: <Clock size={13} /> },
    'Not Started': { bg: 'bg-red-50 border-red-200',         text: 'text-red-600',     icon: <AlertCircle size={13} /> },
  };
  const s = map[status] || map['Not Started'];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${s.bg} ${s.text}`}>
      {s.icon} {status}
    </span>
  );
}

/* ── Progress Bar ─────────────────────────────────────────── */

function ProgressBar({ evaluated, total }: { evaluated: number; total: number }) {
  const pct = total > 0 ? Math.round((evaluated / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full min-w-[120px]">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-300'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-gray-500 min-w-[36px] text-right">{pct}%</span>
    </div>
  );
}

/* ── Score Ring (for video detail) ────────────────────────── */

function ScoreRing({ score, label }: { score: number; label: string }) {
  const pct = (score / 10) * 100;
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = score >= 8 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={radius} stroke="#e5e7eb" strokeWidth="4" fill="none" />
        <circle cx="28" cy="28" r={radius} stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <span className="text-[13px] font-extrabold" style={{ color }}>{score}</span>
      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</span>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */

export default function EvaluationProgressPage() {
  const { data, isLoading: loading } = useSWR<StudentProgress[]>('/api/reports/evaluation-progress', fetcher);
  const rows: StudentProgress[] = Array.isArray(data) ? data : [];

  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterCity, setFilterCity] = useState('All');
  const [filterSchool, setFilterSchool] = useState('All');
  const [filterClass, setFilterClass] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<VideoEntry | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    setIsSuperAdmin(!!localStorage.getItem('token'));
  }, []);

  /* ── Derived Filters ────── */
  const states = useMemo(() => ['All', ...Array.from(new Set(rows.map(r => r.state).filter(Boolean) as string[])).sort()], [rows]);
  const districts = useMemo(() => {
    const base = rows.filter(r => filterState === 'All' || r.state === filterState);
    return ['All', ...Array.from(new Set(base.map(r => r.district).filter(Boolean) as string[])).sort()];
  }, [rows, filterState]);
  const cities = useMemo(() => {
    const base = rows.filter(r =>
      (filterState === 'All' || r.state === filterState) &&
      (filterDistrict === 'All' || r.district === filterDistrict)
    );
    return ['All', ...Array.from(new Set(base.map(r => r.city).filter(Boolean) as string[])).sort()];
  }, [rows, filterState, filterDistrict]);
  const schools = useMemo(() => {
    const base = rows.filter(r =>
      (filterState === 'All' || r.state === filterState) &&
      (filterDistrict === 'All' || r.district === filterDistrict) &&
      (filterCity === 'All' || r.city === filterCity)
    );
    const unique = Array.from(new Map(base.map(r => [r.schoolId, r.schoolName])).entries())
      .filter(([id]) => id)
      .sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));
    return [['All', 'All Schools'], ...unique] as [string, string][];
  }, [rows, filterState, filterDistrict, filterCity]);
  const classes = useMemo(() =>
    ['All', ...Array.from(new Set(rows.map(r => r.className).filter(Boolean) as string[])).sort()],
  [rows]);

  const activeFilterCount = [filterState, filterDistrict, filterCity, filterSchool, filterClass, filterStatus].filter(v => v !== 'All').length;
  const clearFilters = () => {
    setFilterState('All'); setFilterDistrict('All'); setFilterCity('All');
    setFilterSchool('All'); setFilterClass('All'); setFilterStatus('All'); setSearch('');
  };

  /* ── Filtered Data ────── */
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterState !== 'All' && r.state !== filterState) return false;
      if (filterDistrict !== 'All' && r.district !== filterDistrict) return false;
      if (filterCity !== 'All' && r.city !== filterCity) return false;
      if (filterSchool !== 'All' && r.schoolId !== filterSchool) return false;
      if (filterClass !== 'All' && r.className !== filterClass) return false;
      if (filterStatus !== 'All' && r.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.olympiadCode.toLowerCase().includes(q) ||
          (r.schoolName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, search, filterState, filterDistrict, filterCity, filterSchool, filterClass, filterStatus]);

  /* ── Summary Stats ────── */
  const totalStudents = filtered.length;
  const totalCompleted = filtered.filter(r => r.status === 'Completed').length;
  const totalInProgress = filtered.filter(r => r.status === 'In Progress').length;
  const totalNotStarted = filtered.filter(r => r.status === 'Not Started').length;
  const totalVideos = filtered.reduce((s, r) => s + r.totalVideos, 0);
  const totalEvaluated = filtered.reduce((s, r) => s + r.evaluatedVideos, 0);

  /* ── CSV Export ────── */
  const downloadCSV = () => {
    const header = ['Name', 'Olympiad Code', 'Class', 'School', 'State', 'District', 'Source', 'Total Videos', 'Evaluated', 'Pending', 'Status'];
    const csvRows = filtered.map(r => [
      r.name, r.olympiadCode, r.className || '-', r.schoolName || '-',
      r.state || '-', r.district || '-', r.source, r.totalVideos,
      r.evaluatedVideos, r.pendingVideos, r.status,
    ]);
    const csv = [header, ...csvRows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `evaluation-progress-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  /* ── Loading state ────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#009846]" />
          <p className="text-gray-500 font-medium">Loading evaluation progress…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-200">
            <ClipboardCheck className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Evaluation Progress</h1>
            <p className="text-sm text-gray-400">Student-wise evaluation status for Olympiad videos</p>
          </div>
        </div>
        <button onClick={downloadCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all hover:shadow-md active:scale-95">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Students', value: totalStudents, icon: <Users size={18} />, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-200' },
          { label: 'Total Videos',   value: totalVideos,   icon: <Video size={18} />, color: 'from-purple-500 to-violet-600', shadow: 'shadow-purple-200' },
          { label: 'Evaluated',      value: totalEvaluated, icon: <CheckCircle2 size={18} />, color: 'from-emerald-500 to-green-600', shadow: 'shadow-emerald-200' },
          { label: 'Completed',      value: totalCompleted, icon: <CheckCircle2 size={18} />, color: 'from-teal-500 to-cyan-600', shadow: 'shadow-teal-200' },
          { label: 'In Progress',    value: totalInProgress, icon: <Clock size={18} />, color: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200' },
          { label: 'Not Started',    value: totalNotStarted, icon: <AlertCircle size={18} />, color: 'from-red-400 to-rose-500', shadow: 'shadow-red-200' },
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

      {/* ── Filters Row ── */}
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Search */}
          <div className="relative col-span-2 md:col-span-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input type="text" placeholder="Search name/code…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none" />
          </div>
          <FilterSelect label="State" value={filterState} onChange={v => { setFilterState(v); setFilterDistrict('All'); setFilterCity('All'); setFilterSchool('All'); }} options={states.map(s => ({ value: s, label: s }))} />
          <FilterSelect label="District" value={filterDistrict} onChange={v => { setFilterDistrict(v); setFilterCity('All'); setFilterSchool('All'); }} options={districts.map(d => ({ value: d, label: d }))} />
          <FilterSelect label="City" value={filterCity} onChange={v => { setFilterCity(v); setFilterSchool('All'); }} options={cities.map(c => ({ value: c, label: c }))} />
          <FilterSelect label="School" value={filterSchool} onChange={setFilterSchool} options={schools.map(([v, l]) => ({ value: v, label: l }))} />
          <FilterSelect label="Class" value={filterClass} onChange={setFilterClass} options={classes.map(c => ({ value: c, label: c }))} />
          <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={[
            { value: 'All', label: 'All' },
            { value: 'Completed', label: 'Completed' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Not Started', label: 'Not Started' },
          ]} />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Olympiad Code</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Class</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">School</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Videos</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-16 text-center text-gray-400 font-medium">No students found.</td></tr>
              )}
              {filtered.map((row, idx) => {
                const isExpanded = expandedRow === row.studentKey;
                return (
                  <Fragment key={row.studentKey}>
                    <tr
                      onClick={() => setExpandedRow(isExpanded ? null : row.studentKey)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${isExpanded ? 'bg-violet-50/60' : 'hover:bg-gray-50'}`}>
                      <td className="py-3 px-4">
                        {isExpanded
                          ? <ChevronUp size={16} className="text-violet-500" />
                          : <ChevronDown size={16} className="text-gray-400" />}
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0">
                            {row.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <p className="font-bold text-gray-900 text-[13px]">{row.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-600 font-semibold">{row.olympiadCode}</td>
                      <td className="py-3 px-4 text-gray-600 text-xs">{row.className || '-'}</td>
                      <td className="py-3 px-4 text-gray-600 text-xs max-w-[200px] truncate" title={row.schoolName || '-'}>{row.schoolName || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-extrabold text-gray-800">{row.evaluatedVideos}</span>
                        <span className="text-gray-400 font-medium">/{row.totalVideos}</span>
                      </td>
                      <td className="py-3 px-4">
                        <ProgressBar evaluated={row.evaluatedVideos} total={row.totalVideos} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>

                    {/* ── Expanded Video Detail ── */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="bg-violet-50/30 border-b border-violet-100 px-6 py-5">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-3">
                              <Video size={15} className="text-violet-500" />
                              <span className="text-sm font-bold text-violet-700">{row.name}&apos;s Videos ({row.totalVideos})</span>
                            </div>
                            <div className="grid gap-3">
                              {row.videos.map((vid, vi) => (
                                <div key={vid.id}
                                  className={`bg-white rounded-xl border p-4 flex items-start gap-4 transition-shadow hover:shadow-md ${
                                    vid.isEvaluated ? 'border-emerald-200' : 'border-amber-200'
                                  }`}>
                                  {/* Video thumbnail / play */}
                                  <button
                                    onClick={e => { e.stopPropagation(); setVideoModal(vid); }}
                                    className="relative w-24 h-16 rounded-lg overflow-hidden bg-gray-900 flex-shrink-0 group">
                                    {vid.thumbnailUrl ? (
                                      <img src={vid.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                                        <Video size={18} className="text-gray-500" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                                      <Play size={20} className="text-white drop-shadow-lg" />
                                    </div>
                                  </button>

                                  {/* Meta */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-bold text-gray-700">Video {vi + 1}</span>
                                      {vid.category && (
                                        <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{vid.category}</span>
                                      )}
                                      {vid.subCategory && (
                                        <span className="text-[10px] font-semibold bg-fuchsia-100 text-fuchsia-700 px-2 py-0.5 rounded-full">{vid.subCategory}</span>
                                      )}
                                      {vid.isEvaluated ? (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-0.5"><CheckCircle2 size={10} /> Evaluated</span>
                                          {isSuperAdmin && (
                                            <Link
                                              href={`/dashboard/evaluator/evaluate-content?videoId=${vid.id}`}
                                              className="text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                                            >
                                              <Pencil size={8} /> Modify
                                            </Link>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-0.5"><Clock size={10} /> Pending</span>
                                          <Link
                                            href={`/dashboard/evaluator/evaluate-content?videoId=${vid.id}`}
                                            className="text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                                          >
                                            <Play size={8} fill="currentColor" /> Evaluate
                                          </Link>
                                        </div>
                                      )}
                                    </div>
                                    {vid.caption && <p className="text-xs text-gray-500 truncate">{vid.caption}</p>}
                                    <p className="text-[10px] text-gray-400 mt-0.5">Uploaded: {new Date(vid.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                  </div>

                                  {/* Scores (if evaluated) */}
                                  {vid.isEvaluated && vid.evaluation && (
                                    <div className="hidden lg:flex items-center gap-4">
                                      <ScoreRing score={vid.evaluation.confidenceScore} label="Conf" />
                                      <ScoreRing score={vid.evaluation.creativityScore} label="Crea" />
                                      <ScoreRing score={vid.evaluation.techniqueScore} label="Tech" />
                                      <ScoreRing score={vid.evaluation.presentationScore} label="Pres" />
                                      <div className="flex flex-col items-center">
                                        <span className="text-2xl font-black text-gray-900">{vid.evaluation.totalScore}</span>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase">/40 Total</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
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
        {/* Count */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400 font-medium">
          Showing {filtered.length} of {rows.length} students
        </div>
      </div>

      {/* ── Video Player Modal ── */}
      {videoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setVideoModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <span className="font-bold text-gray-800">Video Player</span>
              <button onClick={() => setVideoModal(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="aspect-video bg-black">
              <video src={videoModal.videoUrl} controls autoPlay className="w-full h-full" />
            </div>
            {videoModal.isEvaluated && videoModal.evaluation && (
              <div className="p-5 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <BarChart2 size={16} className="text-violet-500" />
                  <span className="text-sm font-bold text-gray-700">Evaluation Scores</span>
                  <span className="ml-auto text-xs text-gray-400">By: {videoModal.evaluation.evaluatorName} • {new Date(videoModal.evaluation.evaluatedAt).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-center gap-6">
                  <ScoreRing score={videoModal.evaluation.confidenceScore} label="Confidence" />
                  <ScoreRing score={videoModal.evaluation.creativityScore} label="Creativity" />
                  <ScoreRing score={videoModal.evaluation.techniqueScore} label="Technique" />
                  <ScoreRing score={videoModal.evaluation.presentationScore} label="Presentation" />
                  <div className="flex flex-col items-center px-4 border-l border-gray-200">
                    <span className="text-3xl font-black text-gray-900">{videoModal.evaluation.totalScore}</span>
                    <span className="text-[11px] text-gray-400 font-bold">/40</span>
                  </div>
                </div>
                {videoModal.evaluation.remarks && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-gray-600">
                    <span className="font-bold text-gray-700">Remarks:</span> {videoModal.evaluation.remarks}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Filter Select Component ─────────────────────────────── */

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none appearance-none cursor-pointer"
      title={label}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.value === 'All' ? `All ${label}s` : o.label}</option>
      ))}
    </select>
  );
}
