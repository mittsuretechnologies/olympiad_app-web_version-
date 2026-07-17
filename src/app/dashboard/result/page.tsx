'use client';

import { Fragment, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  Award, Loader2, Search, Download, ChevronDown, ChevronUp,
  Users, Filter, X, CheckCircle2, AlertCircle, Lock, Unlock,
} from 'lucide-react';

interface VideoResultEntry {
  id: string;
  category: string | null;
  subCategory: string | null;
  koshes: [string, string];
  koshScores: { kosh: string; totalScore: number; isPublished: boolean; evaluatorName: string | null }[];
  isEvaluated: boolean;
  isPublished: boolean;
  videoPercent: number | null;
  evaluatorName: string | null;
}

interface KoshBreakdownEntry {
  kosh: string;
  label: string;
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
  videos: VideoResultEntry[];
  examPercentage: number | null;
  examTotalScore: number | null;
  examMaxScore: number | null;
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

export default function ResultPage() {
  const { data, isLoading: loading } = useSWR<StudentResult[]>('/api/result/overview', fetcher);
  const rows: StudentResult[] = Array.isArray(data) ? data : [];

  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterSchool, setFilterSchool] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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
    const header = ['Name', 'Olympiad Code', 'Class', 'School', 'Exam %', 'Video Score', ...koshLabels.map(l => `${l} %`), 'Holistic %', 'Status'];
    const csvRows = filtered.map(r => {
      const koshByLabel = new Map(r.koshBreakdown.map(k => [k.label, k.combinedPercent]));
      return [
        r.name, r.olympiadCode, r.className || '-', r.schoolName || '-',
        r.examPercentage ?? '-', `${r.videoScoreTotal}/${r.videoMaxScore}`,
        ...koshLabels.map(l => koshByLabel.get(l) ?? '-'),
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
        <button onClick={downloadCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all hover:shadow-md active:scale-95">
          <Download size={16} /> Export CSV
        </button>
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
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-8"></th>
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Olympiad Code</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">School</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Exam %</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Videos /40</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Holistic %</th>
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
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${isExpanded ? 'bg-amber-50/60' : 'hover:bg-gray-50'}`}>
                      <td className="py-3 px-4">
                        {isExpanded ? <ChevronUp size={16} className="text-amber-500" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-medium">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0">
                            {row.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <p className="font-bold text-gray-900 text-[13px]">{row.name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-600 font-semibold">{row.olympiadCode}</td>
                      <td className="py-3 px-4 text-gray-600 text-xs max-w-[200px] truncate" title={row.schoolName || '-'}>{row.schoolName || '-'}</td>
                      <td className="py-3 px-4 text-center font-bold text-gray-700">{row.examPercentage !== null ? `${row.examPercentage}%` : '-'}</td>
                      <td className="py-3 px-4 text-center font-bold text-gray-700">{row.videoScoreTotal}/{row.videoMaxScore}</td>
                      <td className="py-3 px-4 text-center">
                        {row.holisticPercent !== null ? (
                          <span className={`text-lg font-black ${percentBandClass(row.holisticPercent)}`}>{row.holisticPercent}%</span>
                        ) : (
                          <span className="text-sm text-gray-400 font-semibold">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center"><StatusBadge status={row.status} /></td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="bg-amber-50/30 border-b border-amber-100 px-6 py-5">
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Kosh Breakdown</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {row.koshBreakdown.map(k => (
                                  <div key={k.kosh} className="bg-white rounded-xl border border-gray-200 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-bold text-gray-700">{k.label}</span>
                                      {k.combinedPercent !== null && (
                                        <span className={`text-sm font-black ${percentBandClass(k.combinedPercent)}`}>{k.combinedPercent}%</span>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold">
                                      <span>Exam: {k.examPercent !== null ? `${k.examPercent}%` : '—'}</span>
                                      <span>Video: {k.videoPercent !== null ? `${k.videoPercent}%` : '—'}</span>
                                    </div>
                                  </div>
                                ))}
                                {row.koshBreakdown.length === 0 && (
                                  <p className="text-xs text-gray-400 col-span-full">No kosh data yet — pending exam scan and/or video evaluation.</p>
                                )}
                              </div>
                            </div>

                            <div className="grid gap-3">
                              {row.videos.map((vid, vi) => (
                                <div key={vid.id} className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-4 ${
                                  vid.isPublished ? 'border-emerald-200' : vid.isEvaluated ? 'border-amber-200' : 'border-gray-200'
                                }`}>
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
                                  <div className="flex items-center gap-3">
                                    {vid.isEvaluated && (
                                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                        vid.isPublished ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                                      }`}>
                                        {vid.isPublished ? <Lock size={10} /> : <Unlock size={10} />}
                                        {vid.isPublished ? 'Published' : 'Draft'}
                                      </span>
                                    )}
                                    <div className="flex flex-col items-center min-w-[50px]">
                                      <span className="text-xl font-black text-gray-900">{vid.videoPercent !== null ? `${vid.videoPercent}%` : '-'}</span>
                                      <span className="text-[10px] text-gray-400 font-bold uppercase">video score</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
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
    </div>
  );
}
