'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Download, Loader2, Send, Undo2, AlertTriangle, CheckCircle2, Users, MapPin, School } from 'lucide-react';
import { fetcher, authFetch } from '@/lib/swr';

interface Row {
  studentKey: string;
  name: string;
  olympiadCode: string;
  className: string | null;
  schoolName: string | null;
  schoolCode: string | null;
  state: string | null;
  district: string | null;
  holisticPercent: number;
  rank: number;
  forwarded: boolean;
  forwardedAt: string | null;
  outOfPool: boolean;
}
interface Response { topN: number; topPercents: number[]; tableReady: boolean; students: Row[] }

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export default function DistrictForwardPage() {
  const { data, error, isLoading, mutate } = useSWR<Response>('/api/result/district-forward', fetcher, { revalidateOnFocus: false });
  const [busy, setBusy] = useState<string | null>(null); // 'all' | olympiad code
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const students = data?.students ?? [];
  const pool = students.filter(s => !s.outOfPool);
  const pending = pool.filter(s => !s.forwarded).length;
  const forwardedCount = students.filter(s => s.forwarded).length;
  const noDistrict = pool.filter(s => !s.district || !s.district.trim()).length;

  const countByPercent = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of pool) m.set(s.holisticPercent, (m.get(s.holisticPercent) || 0) + 1);
    return m;
  }, [pool]);

  const districts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of pool) { const k = s.district?.trim() || '(no district)'; m.set(k, (m.get(k) || 0) + 1); }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [pool]);

  const call = async (key: string, method: 'POST' | 'DELETE', body?: object) => {
    setBusy(key);
    setNotice(null);
    try {
      const res = await authFetch('/api/result/district-forward', {
        method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || 'Something went wrong');
      await mutate();
      return j;
    } catch (e: any) {
      setNotice({ ok: false, text: e?.message || 'Something went wrong' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const forwardAll = async () => {
    if (!window.confirm(`Forward ${pending} student${pending === 1 ? '' : 's'} to the district level?\n\nThese are everyone on the top ${data?.topN} holistic percentages across all schools.`)) return;
    const j = await call('all', 'POST');
    if (j) setNotice({ ok: true, text: `${j.forwarded} student${j.forwarded === 1 ? '' : 's'} forwarded to the district level.` });
  };

  const withdraw = async (s: Row) => {
    if (!window.confirm(`Withdraw ${s.name} (${s.olympiadCode}) from the district level?`)) return;
    const j = await call(s.olympiadCode, 'DELETE', { olympiadCode: s.olympiadCode });
    if (j) setNotice({ ok: true, text: `${s.name} withdrawn.` });
  };

  const withdrawAll = async () => {
    if (!window.confirm(`Withdraw ALL ${forwardedCount} forwarded students from the district level?`)) return;
    const j = await call('all', 'DELETE', { all: true });
    if (j) setNotice({ ok: true, text: `${j.withdrawn} withdrawn.` });
  };

  const exportCsv = () => {
    const header = ['Rank', 'Holistic %', 'Student', 'Olympiad ID', 'Class', 'School', 'School ID', 'District', 'State', 'Forwarded'];
    const lines = students.map(s => [
      s.outOfPool ? '' : s.rank, s.holisticPercent, s.name, s.olympiadCode, s.className || '', s.schoolName || '', s.schoolCode || '',
      s.district || '', s.state || '', s.forwarded ? fmtDate(s.forwardedAt) : 'No',
    ]);
    const csv = [header, ...lines].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `district-level-students-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#009846]" />
          <p className="text-gray-500 font-medium">Ranking all schools… this can take a few seconds</p>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <div className="bg-white rounded-2xl border border-red-100 shadow-sm py-10 text-center text-red-500 font-medium">Could not load the district pool. Please refresh.</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
            <h1 className="text-2xl font-medium text-[#004f9f]">District Level</h1>
          </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} disabled={students.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
            <Download size={16} /> Export CSV
          </button>
          {forwardedCount > 0 && (
            <button onClick={withdrawAll} disabled={busy !== null}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
              <Undo2 size={16} /> Withdraw all
            </button>
          )}
          <button onClick={forwardAll} disabled={pending === 0 || busy !== null || !data.tableReady}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#06013E] text-[#F5E9C8] text-sm font-bold shadow-md hover:bg-[#0a0258] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {busy === 'all' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Forward {pending > 0 ? `${pending} ` : ''}to district
          </button>
        </div>
      </div>

      {!data.tableReady && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>The DistrictForward table has not been created in the database yet, so forwarding is switched off. You can still see the pool below.</span>
        </div>
      )}
      {noDistrict > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{noDistrict} student{noDistrict === 1 ? '' : 's'} in the pool belong to a school with no district set.</span>
        </div>
      )}
      {notice && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${notice.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {notice.ok && <CheckCircle2 size={16} />}{notice.text}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'In the pool', value: pool.length, icon: <Users size={18} />, color: 'from-blue-500 to-indigo-600' },
          { label: 'Forwarded', value: forwardedCount, icon: <CheckCircle2 size={18} />, color: 'from-emerald-500 to-green-600' },
          { label: 'Still to forward', value: pending, icon: <Send size={18} />, color: 'from-amber-400 to-orange-500' },
          { label: 'Districts', value: districts.length, icon: <MapPin size={18} />, color: 'from-violet-500 to-purple-600' },
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

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:col-span-2">
          <p className="text-sm font-bold text-gray-700 mb-3">Top {data.topN} holistic percentages</p>
          {data.topPercents.length === 0 ? (
            <p className="text-sm text-gray-400">No student has a complete result yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.topPercents.map((p, i) => (
                <span key={p} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-sm font-bold text-amber-900">
                  <span className="text-[11px] font-semibold text-amber-600">#{i + 1}</span>{p}%
                  <span className="text-[11px] font-bold bg-white rounded-full px-2 py-0.5 text-gray-600">{countByPercent.get(p) || 0} student{(countByPercent.get(p) || 0) === 1 ? '' : 's'}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">By district</p>
          {districts.length === 0 ? <p className="text-sm text-gray-400">—</p> : (
            <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {districts.map(([d, n]) => (
                <li key={d} className="flex items-center justify-between text-sm">
                  <span className={`truncate ${d === '(no district)' ? 'text-amber-700 font-semibold' : 'text-gray-700'}`}>{d}</span>
                  <span className="font-bold text-gray-900 ml-2">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {['Rank', 'Holistic %', 'Student', 'School', 'District', 'State', 'Status', ''].map(h => (
                  <th key={h} className="py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={8} className="py-14 text-center text-gray-400 font-medium">No students to show yet.</td></tr>
              )}
              {students.map(s => (
                <tr key={s.olympiadCode} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="py-3 px-3 font-bold text-gray-500">{s.outOfPool ? '—' : `#${s.rank}`}</td>
                  <td className="py-3 px-3 font-black text-gray-900">{s.holisticPercent}%</td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-gray-900 text-[13px]">{s.name}</p>
                    <p className="font-mono text-[11px] text-gray-500">{s.olympiadCode}{s.className ? ` · ${s.className}` : ''}</p>
                  </td>
                  <td className="py-3 px-3 max-w-[220px]">
                    <p className="text-[13px] text-gray-700 truncate" title={s.schoolName || ''}><School size={12} className="inline mr-1 -mt-0.5 text-gray-400" />{s.schoolName || '—'}</p>
                    <p className="font-mono text-[11px] text-gray-400">{s.schoolCode || ''}</p>
                  </td>
                  <td className="py-3 px-3 text-gray-700">{s.district?.trim() || <span className="text-amber-700 font-semibold">Not set</span>}</td>
                  <td className="py-3 px-3 text-gray-500">{s.state || '—'}</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {s.forwarded ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 border border-green-200 text-green-700">
                        <CheckCircle2 size={12} /> Forwarded {fmtDate(s.forwardedAt)}
                      </span>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-700">Not forwarded</span>
                    )}
                    {s.outOfPool && <p className="text-[10px] text-red-500 font-semibold mt-0.5">No longer in the top {data.topN}</p>}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {s.forwarded && (
                      <button onClick={() => withdraw(s)} disabled={busy !== null}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
                        {busy === s.olympiadCode ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Withdraw
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
