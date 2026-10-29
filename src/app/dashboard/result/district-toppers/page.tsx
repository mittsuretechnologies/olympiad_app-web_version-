'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Award, Download, Loader2, MapPin, Search, School, Users } from 'lucide-react';
import { fetcher } from '@/lib/swr';

interface Student { name: string; olympiadCode: string; className: string | null; schoolName: string | null; schoolCode: string | null }
interface Tier { rank: number; holisticPercent: number; students: Student[] }
interface DistrictRow { district: string; state: string | null; completeStudents: number; tiers: Tier[] }
interface Response { topN: number; districts: DistrictRow[] }

const RANK_STYLE = [
  'bg-amber-50 border-amber-200 text-amber-800',
  'bg-slate-50 border-slate-200 text-slate-700',
  'bg-orange-50 border-orange-200 text-orange-800',
];

export default function DistrictToppersPage() {
  const { data, error, isLoading } = useSWR<Response>('/api/result/district-toppers', fetcher, { revalidateOnFocus: false });
  const [search, setSearch] = useState('');
  const [state, setState] = useState('All');

  const districts = data?.districts ?? [];
  const states = useMemo(() => ['All', ...Array.from(new Set(districts.map(d => d.state).filter((s): s is string => !!s))).sort()], [districts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return districts.filter(d => {
      if (state !== 'All' && d.state !== state) return false;
      if (!q) return true;
      return d.district.toLowerCase().includes(q)
        || d.tiers.some(t => t.students.some(st => st.name.toLowerCase().includes(q) || st.olympiadCode.toLowerCase().includes(q)
          || (st.schoolName || '').toLowerCase().includes(q)));
    });
  }, [districts, search, state]);

  const studentCount = filtered.reduce((n, d) => n + d.tiers.reduce((m, t) => m + t.students.length, 0), 0);

  const exportCsv = () => {
    const header = ['District', 'State', 'Rank', 'Holistic %', 'Student', 'Olympiad ID', 'Class', 'School', 'School ID'];
    const lines = filtered.flatMap(d => d.tiers.flatMap(t => t.students.map(st =>
      [d.district, d.state || '', t.rank, t.holisticPercent, st.name, st.olympiadCode, st.className || '', st.schoolName || '', st.schoolCode || ''])));
    const csv = [header, ...lines].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `district-toppers-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#009846]" />
          <p className="text-gray-500 font-medium">Ranking every district… this can take a few seconds</p>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <div className="bg-white rounded-2xl border border-red-100 shadow-sm py-10 text-center text-red-500 font-medium">Could not load district toppers. Please refresh.</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
            <h1 className="text-2xl font-medium text-[#004f9f]">District Toppers</h1>
          </div>
        <button onClick={exportCsv} disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Districts with a result', value: filtered.length, icon: <MapPin size={18} />, color: 'from-violet-500 to-purple-600' },
          { label: 'Toppers listed', value: studentCount, icon: <Users size={18} />, color: 'from-blue-500 to-indigo-600' },
          { label: 'Districts in total', value: districts.length, icon: <Award size={18} />, color: 'from-amber-400 to-orange-500' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search district, school, student name or ID…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none" />
        </div>
        <select value={state} onChange={e => setState(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-amber-300 outline-none">
          {states.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400 font-medium">
          {districts.length === 0 ? 'No district has a student with a complete result yet.' : 'No districts match.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <div key={`${d.state}|${d.district}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 bg-gray-50/60">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0">
                  <MapPin size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-gray-900 text-[14px] truncate">{d.district}</p>
                  <p className="text-[11px] text-gray-400 font-medium truncate">{d.state || '—'}</p>
                </div>
                <span className="text-[11px] font-semibold text-gray-500">{d.completeStudents} complete result{d.completeStudents === 1 ? '' : 's'}</span>
              </div>
              <ul className="divide-y divide-gray-50">
                {d.tiers.map(t => (
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
                          <span className="text-[11px] text-gray-400 truncate"><School size={10} className="inline mr-1 -mt-0.5" />{st.schoolName || st.schoolCode || '—'}</span>
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
