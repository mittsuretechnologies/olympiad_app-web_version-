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
  /** Exam marks the student was forwarded on; null for rows forwarded before this was saved. */
  forwardedExamSource: 'manual' | 'ai' | null;
  outOfPool: boolean;
}
interface DistrictRow { key: string; district: string; state: string | null; eligible: number; topPercents: number[]; inPool: number }
interface Response {
  topN: number;
  examSource: 'manual' | 'ai';
  /** Exam marks the existing forwards were made on; forwarding on the other is refused. */
  lockedExamSource: 'manual' | 'ai' | null;
  districts: DistrictRow[];
  /** Both videos scored, but the exam is not scanned / not fully reviewed yet. */
  waitingForExam: number;
  /** Rankable, but their school has no district set. */
  noDistrict: number;
  tableReady: boolean;
  students: Row[];
}

const SOURCE_LABEL = { manual: 'Manual', ai: 'AI' } as const;

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export default function DistrictForwardPage() {
  // Same Manual / AI exam-marks toggle as the Result page: the pool, and what a
  // forward saves, use the exam marks picked here.
  const [examSource, setExamSource] = useState<'manual' | 'ai'>('manual');
  const { data, error, isLoading, mutate } = useSWR<Response>(
    `/api/result/district-forward?examSource=${examSource}`, fetcher, { revalidateOnFocus: false },
  );
  const [busy, setBusy] = useState<string | null>(null); // 'all' | olympiad code
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const students = data?.students ?? [];
  const pool = students.filter(s => !s.outOfPool);
  const pending = pool.filter(s => !s.forwarded).length;
  const forwardedCount = students.filter(s => s.forwarded).length;
  const districts = useMemo(() => data?.districts ?? [], [data]);
  const lockedOther = !!data?.lockedExamSource && data.lockedExamSource !== examSource;

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
    if (!window.confirm(`Forward ${pending} student${pending === 1 ? '' : 's'} to the state level?\n\nThese are everyone on the top ${data?.topN} holistic percentages of each district, using ${SOURCE_LABEL[examSource]} exam marks.`)) return;
    const j = await call('all', 'POST', { examSource });
    if (j) setNotice({ ok: true, text: `${j.forwarded} student${j.forwarded === 1 ? '' : 's'} forwarded to the state level.` });
  };

  const withdraw = async (s: Row) => {
    const reason = window.prompt(`Withdraw ${s.name} (${s.olympiadCode}) from the state level?\n\nReason (saved in the Activity Log):`)?.trim();
    if (!reason) return;
    const j = await call(s.olympiadCode, 'DELETE', { olympiadCode: s.olympiadCode, reason });
    if (j) setNotice({ ok: true, text: `${s.name} withdrawn.` });
  };

  const withdrawAll = async () => {
    const reason = window.prompt(`Withdraw ALL ${forwardedCount} forwarded students from the state level?\n\nReason (saved in the Activity Log):`)?.trim();
    if (!reason) return;
    const j = await call('all', 'DELETE', { all: true, reason });
    if (j) setNotice({ ok: true, text: `${j.withdrawn} withdrawn.` });
  };

  const exportCsv = () => {
    const header = ['Rank', 'Holistic %', 'Student', 'Olympiad ID', 'Class', 'School', 'School ID', 'District', 'State', 'Forwarded', 'Forwarded on exam marks'];
    const lines = students.map(s => [
      s.outOfPool ? '' : s.rank, s.holisticPercent, s.name, s.olympiadCode, s.className || '', s.schoolName || '', s.schoolCode || '',
      s.district || '', s.state || '', s.forwarded ? fmtDate(s.forwardedAt) : 'No',
      s.forwardedExamSource ? SOURCE_LABEL[s.forwardedExamSource] : '',
    ]);
    const csv = [header, ...lines].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `state-level-students-${new Date().toISOString().split('T')[0]}.csv`; a.click();
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
    return <div className="bg-white rounded-2xl border border-red-100 shadow-sm py-10 text-center text-red-500 font-medium">Could not load the state-level pool. Please refresh.</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
            <h1 className="text-2xl font-medium text-[#004f9f]">State Level</h1>
          </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-sm p-1">
            <span className="pl-2 pr-1 text-xs font-bold text-gray-400 uppercase tracking-wide">Exam Score:</span>
            {(['manual', 'ai'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setExamSource(s); setNotice(null); }}
                disabled={busy !== null}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 ${
                  examSource === s ? 'bg-[#06013E] text-[#F5E9C8] shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>
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
          <button onClick={forwardAll} disabled={pending === 0 || busy !== null || !data.tableReady || lockedOther}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#06013E] text-[#F5E9C8] text-sm font-bold shadow-md hover:bg-[#0a0258] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {busy === 'all' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Forward {pending > 0 ? `${pending} ` : ''}to state
          </button>
        </div>
      </div>

      {!data.tableReady && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>The DistrictForward table has not been created in the database yet, so forwarding is switched off. You can still see the pool below.</span>
        </div>
      )}
      {lockedOther && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>Students are already forwarded on {SOURCE_LABEL[data.lockedExamSource!]} exam marks, so forwarding on {SOURCE_LABEL[examSource]} marks is switched off. Switch the toggle back, or withdraw everyone first.</span>
        </div>
      )}
      {data.waitingForExam > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>
            {data.waitingForExam} student{data.waitingForExam === 1 ? ' has' : 's have'} both videos scored but {data.waitingForExam === 1 ? 'is' : 'are'} not ranked yet:
            {examSource === 'manual' ? ' the exam sheet is not scanned, or not every question is reviewed.' : ' no exam sheet is scanned.'}
          </span>
        </div>
      )}
      {data.noDistrict > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{data.noDistrict} student{data.noDistrict === 1 ? '' : 's'} with a complete result belong to a school with no district set, so they are in no district&apos;s ranking. Set the district on those schools.</span>
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <p className="text-sm font-bold text-gray-700 mb-1">By district</p>
        <p className="text-xs text-gray-400 mb-3">Each district&apos;s top {data.topN} distinct holistic percentages qualify; ties share a rank, so a district can send more than {data.topN}.</p>
        {districts.length === 0 ? <p className="text-sm text-gray-400">No student has a complete result yet.</p> : (
          <div className="max-h-72 overflow-y-auto pr-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  {['District', 'State', 'Ranked', 'Qualifying', 'Cut-off %'].map(h => (
                    <th key={h} className="py-2 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {districts.map(d => (
                  <tr key={d.key} className="border-b border-gray-50">
                    <td className="py-1.5 px-2 font-semibold text-gray-800">{d.district}</td>
                    <td className="py-1.5 px-2 text-gray-500">{d.state || '—'}</td>
                    <td className="py-1.5 px-2 text-gray-700">{d.eligible}</td>
                    <td className="py-1.5 px-2 font-bold text-gray-900">{d.inPool}</td>
                    <td className="py-1.5 px-2 text-gray-700">{d.topPercents.length ? `${d.topPercents[d.topPercents.length - 1]}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                    {s.outOfPool && <p className="text-[10px] text-red-500 font-semibold mt-0.5">No longer in their district&apos;s top {data.topN}</p>}
                    {s.forwarded && s.forwardedExamSource && (
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">on {SOURCE_LABEL[s.forwardedExamSource]} exam marks</p>
                    )}
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
