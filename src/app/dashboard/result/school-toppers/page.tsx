'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Award, Download, Loader2, Search, School, Users, Medal } from 'lucide-react';
import { fetcher } from '@/lib/swr';

interface Student { name: string; olympiadCode: string; className: string | null }
interface Tier { rank: number; holisticPercent: number; students: Student[] }
interface SchoolRow {
  schoolCode: string; schoolName: string | null; city: string | null; district: string | null; state: string | null;
  completeStudents: number; tiers: Tier[];
}
interface Response { topN: number; schools: SchoolRow[] }

const RANK_STYLE = [
  'bg-amber-50 border-amber-200 text-amber-800',
  'bg-slate-50 border-slate-200 text-slate-700',
  'bg-orange-50 border-orange-200 text-orange-800',
];

export default function SchoolToppersPage() {
  const { data, error, isLoading } = useSWR<Response>('/api/result/school-toppers', fetcher, { revalidateOnFocus: false });
  const [search, setSearch] = useState('');
  const [state, setState] = useState('All');

  const schools = data?.schools ?? [];
  const states = useMemo(() => ['All', ...Array.from(new Set(schools.map(s => s.state).filter((s): s is string => !!s))).sort()], [schools]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schools.filter(s => {
      if (state !== 'All' && s.state !== state) return false;
      if (!q) return true;
      return (s.schoolName || '').toLowerCase().includes(q) || s.schoolCode.toLowerCase().includes(q)
        || (s.district || '').toLowerCase().includes(q)
        || s.tiers.some(t => t.students.some(st => st.name.toLowerCase().includes(q) || st.olympiadCode.toLowerCase().includes(q)));
    });
  }, [schools, search, state]);

  const studentCount = filtered.reduce((n, s) => n + s.tiers.reduce((m, t) => m + t.students.length, 0), 0);

  const exportCsv = () => {
    const header = ['School ID', 'School', 'District', 'State', 'Rank', 'Holistic %', 'Student', 'Olympiad ID', 'Class'];
    const lines = filtered.flatMap(s => s.tiers.flatMap(t => t.students.map(st =>
      [s.schoolCode, s.schoolName || '', s.district || '', s.state || '', t.rank, t.holisticPercent, st.name, st.olympiadCode, st.className || ''])));
    const csv = [header, ...lines].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `school-toppers-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#009846]" />
          <p className="text-gray-500 font-medium">Ranking every school… this can take a few seconds</p>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <div className="bg-white rounded-2xl border border-red-100 shadow-sm py-10 text-center text-red-500 font-medium">Could not load school toppers. Please refresh.</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-200">
            <Medal className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">School Toppers</h1>
            <p className="text-sm text-gray-400 max-w-2xl">
              Each school&apos;s top {data.topN} distinct holistic percentages, and every student on them. Only students with a complete result are ranked.
            </p>
          </div>
        </div>
        <button onClick={exportCsv} disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Schools with a result', value: filtered.length, icon: <School size={18} />, color: 'from-violet-500 to-purple-600' },
          { label: 'Toppers listed', value: studentCount, icon: <Users size={18} />, color: 'from-blue-500 to-indigo-600' },
          { label: 'Schools in total', value: schools.length, icon: <Award size={18} />, color: 'from-amber-400 to-orange-500' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${c.color} shadow-md flex items-center justify-center text-white`}>{c.icon}</div>
              <span className="text-xs text-gray-400 font-semibold">{c.label}</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search school, district, student name or ID…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none" />
        </div>
        <select value={state} onChange={e => setState(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-amber-300 outline-none">
          {states.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400 font-medium">
          {schools.length === 0 ? 'No school has a student with a complete result yet.' : 'No schools match.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <div key={s.schoolCode} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 bg-gray-50/60">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0">
                  <School size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-gray-900 text-[14px] truncate">{s.schoolName || s.schoolCode}</p>
                  <p className="text-[11px] text-gray-400 font-medium truncate">
                    {[s.schoolCode, s.city, s.district, s.state].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-gray-500">{s.completeStudents} complete result{s.completeStudents === 1 ? '' : 's'}</span>
              </div>
              <ul className="divide-y divide-gray-50">
                {s.tiers.map(t => (
                  <li key={t.rank} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <div className="flex items-center gap-2 w-28 flex-shrink-0">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-black ${RANK_STYLE[t.rank - 1] || RANK_STYLE[2]}`}>#{t.rank}</span>
                      <span className="text-base font-black text-gray-900">{t.holisticPercent}%</span>
                    </div>
                    <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                      {t.students.map(st => (
                        <span key={st.olympiadCode} className="inline-flex flex-col px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                          <span className="text-[13px] font-bold text-gray-800">{st.name}</span>
                          <span className="font-mono text-[11px] text-gray-500">{st.olympiadCode}{st.className ? ` · ${st.className}` : ''}</span>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
