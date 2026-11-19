'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle, CheckCircle2, Clock, Download, Loader2, Lock, School, Send, Snowflake, Trophy, Undo2, Users, Video,
} from 'lucide-react';
import { fetcher, authFetch } from '@/lib/swr';

// Result → National Level (lib/national-result.ts). Each state's Rank 1 on the
// frozen State Toppers list is forwarded here. National % = the average of
// Level 1 %, State video %, Virtual Assessment % and National video % (25%
// each; a missing part counts 0). The Virtual Assessment runs outside the app:
// its marks are typed in on this page. The top 3 distinct National %s win.

interface Candidate {
  olympiadCode: string; name: string; className: string | null; schoolName: string | null; schoolCode: string | null;
  district: string | null; state: string | null; stage1Percent: number; stateVideoPercent: number; stateHolisticPercent: number;
  forwarded: boolean;
}
interface Competitor extends Omit<Candidate, 'forwarded'> {
  forwardedAt: string;
  hasAppAccount: boolean;
  assessment: { score: number; max: number; percent: number; enteredAt: string | null } | null;
  video: { id: string; status: string; subCategory: string | null; evaluated: boolean; published: boolean; totalScore: number | null } | null;
  videoProgress: 'NO_VIDEO' | 'AWAITING_MARKS' | 'SCORED';
  nationalVideoPercent: number | null;
  nationalPercent: number;
}
interface Tier { rank: number; nationalPercent: number; students: Competitor[] }
interface FrozenRow {
  id: string; rank: number; olympiadCode: string; name: string; className: string | null; schoolName: string | null;
  schoolCode: string | null; district: string | null; state: string | null; nationalPercent: number | null; frozenAt: string;
}
interface Response {
  topN: number; tableReady: boolean; stateFrozen: boolean;
  candidates: Candidate[]; competitors: Competitor[]; winners: Tier[];
  frozen: { frozenAt: string | null; rows: FrozenRow[] };
}

const PROGRESS: Record<Competitor['videoProgress'], { label: string; cls: string }> = {
  SCORED: { label: 'Scored', cls: 'bg-green-50 border-green-200 text-green-700' },
  AWAITING_MARKS: { label: 'Awaiting marks', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  NO_VIDEO: { label: 'No video (0)', cls: 'bg-gray-50 border-gray-200 text-gray-500' },
};
const RANK_STYLE = [
  'bg-amber-50 border-amber-200 text-amber-800',
  'bg-slate-50 border-slate-200 text-slate-700',
  'bg-orange-50 border-orange-200 text-orange-800',
];
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export default function NationalLevelPage() {
  const { data, error, isLoading, mutate } = useSWR<Response>('/api/result/national', fetcher, { revalidateOnFocus: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [view, setView] = useState<'LIVE' | 'FROZEN'>('FROZEN');
  // Assessment marks being typed, per Olympiad ID.
  const [marks, setMarks] = useState<Record<string, { score: string; max: string }>>({});

  const competitors = useMemo(() => data?.competitors ?? [], [data]);
  const pendingForward = (data?.candidates ?? []).filter(c => !c.forwarded);
  const counts = useMemo(() => ({
    assessed: competitors.filter(c => c.assessment).length,
    videoScored: competitors.filter(c => c.videoProgress === 'SCORED').length,
    noApp: competitors.filter(c => !c.hasAppAccount).length,
  }), [competitors]);
  const showFrozen = !!data?.frozen.rows.length && view === 'FROZEN';

  const call = async (key: string, method: 'POST' | 'DELETE', body: object) => {
    setBusy(key); setNotice(null);
    try {
      const res = await authFetch('/api/result/national', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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

  const forward = async () => {
    if (!window.confirm(`Forward ${pendingForward.length} student${pendingForward.length === 1 ? '' : 's'} to the National Level?\n\nThese are Rank 1 of each state on the frozen State Toppers list.`)) return;
    const j = await call('forward', 'POST', { action: 'forward' });
    if (j) setNotice({ ok: true, text: `${j.forwarded} student${j.forwarded === 1 ? '' : 's'} forwarded to the National Level.` });
  };
  const withdraw = async (c: Competitor) => {
    const reason = window.prompt(`Withdraw ${c.name} (${c.olympiadCode}) from the National Level?\n\nReason (saved in the Activity Log):`)?.trim();
    if (!reason) return;
    const j = await call(`w:${c.olympiadCode}`, 'DELETE', { action: 'withdraw', olympiadCode: c.olympiadCode, reason });
    if (j) setNotice({ ok: true, text: `${c.name} withdrawn.` });
  };
  const saveMarks = async (c: Competitor) => {
    const m = marks[c.olympiadCode] ?? { score: c.assessment ? String(c.assessment.score) : '', max: c.assessment ? String(c.assessment.max) : '' };
    const clear = m.score.trim() === '';
    const j = await call(`a:${c.olympiadCode}`, 'POST', clear
      ? { action: 'assessment', olympiadCode: c.olympiadCode, score: null }
      : { action: 'assessment', olympiadCode: c.olympiadCode, score: Number(m.score), max: Number(m.max) });
    if (j) {
      setMarks(prev => { const next = { ...prev }; delete next[c.olympiadCode]; return next; });
      setNotice({ ok: true, text: clear ? `Assessment marks cleared for ${c.name}.` : `Assessment marks saved for ${c.name}.` });
    }
  };
  const freeze = async () => {
    const missing = competitors.filter(c => !c.assessment || c.videoProgress !== 'SCORED').length;
    const warn = missing ? `\n\n${missing} competitor${missing === 1 ? ' is' : 's are'} missing assessment marks or National video marks, which count 0.` : '';
    const again = data?.frozen.rows.length ? '\n\nThe list frozen earlier will be replaced.' : '';
    if (!window.confirm(`Freeze the National Winners as they are right now?${warn}${again}`)) return;
    const j = await call('freeze', 'POST', { action: 'freeze' });
    if (j) { setView('FROZEN'); setNotice({ ok: true, text: `National Winners frozen: ${j.frozen} student${j.frozen === 1 ? '' : 's'}.` }); }
  };
  const unfreeze = async () => {
    if (!window.confirm('Un-freeze the National Winners? The saved list is removed; the live list stays.')) return;
    const j = await call('unfreeze', 'DELETE', { action: 'unfreeze' });
    if (j) setNotice({ ok: true, text: 'National Winners un-frozen.' });
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows: unknown[][] = [
      ['Student', 'Olympiad ID', 'Class', 'School', 'School ID', 'District', 'State', 'Level 1 %', 'State video %',
        'Assessment marks', 'Assessment %', 'National video', 'National video %', 'National %'],
      ...competitors.map(c => [c.name, c.olympiadCode, c.className, c.schoolName, c.schoolCode, c.district, c.state,
        c.stage1Percent, c.stateVideoPercent, c.assessment ? `${c.assessment.score}/${c.assessment.max}` : '',
        c.assessment?.percent ?? 0, PROGRESS[c.videoProgress].label, c.nationalVideoPercent ?? 0, c.nationalPercent]),
    ];
    const url = URL.createObjectURL(new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `national-level-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#009846]" />
          <p className="text-gray-500 font-medium">Building the National Level result…</p>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <div className="bg-white rounded-2xl border border-red-100 shadow-sm py-10 text-center text-red-500 font-medium">Could not load the National Level result. Please refresh.</div>;
  }

  // The winners list shown: the frozen copy, or the live one.
  const tiers: { rank: number; percent: number | null; students: { olympiadCode: string; name: string; className: string | null; schoolName: string | null; schoolCode: string | null; state: string | null }[] }[] = showFrozen
    ? Array.from(data.frozen.rows.reduce((m, r) => {
        const t = m.get(r.rank) || m.set(r.rank, { rank: r.rank, percent: r.nationalPercent, students: [] }).get(r.rank)!;
        t.students.push(r);
        return m;
      }, new Map<number, { rank: number; percent: number | null; students: FrozenRow[] }>()).values()).sort((a, b) => a.rank - b.rank)
    : data.winners.map(t => ({ rank: t.rank, percent: t.nationalPercent, students: t.students }));

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">National Level</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            National % = (Level 1 % + State video % + Virtual Assessment % + National video %) ÷ 4. A missing part counts 0.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportCsv} disabled={competitors.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
            <Download size={16} /> Export CSV
          </button>
          <button onClick={forward} disabled={pendingForward.length === 0 || busy !== null || !data.tableReady}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#06013E] text-[#F5E9C8] text-sm font-bold shadow-md hover:bg-[#0a0258] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {busy === 'forward' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Forward {pendingForward.length > 0 ? `${pendingForward.length} ` : ''}to National
          </button>
        </div>
      </div>

      {!data.tableReady && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>The NationalForward table has not been created yet (prisma/manual-migrations/2026-11-18-national-level.sql), so the National Level is switched off.</span>
        </div>
      )}
      {data.tableReady && !data.stateFrozen && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>The State Toppers list is not frozen yet. Freeze it (Result → State Toppers) to see who qualifies: each state&apos;s Rank 1.</span>
        </div>
      )}
      {counts.noApp > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{counts.noApp} competitor{counts.noApp === 1 ? ' has' : 's have'} no app account on their Olympiad ID, so they cannot upload the National video.</span>
        </div>
      )}
      {notice && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${notice.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {notice.ok && <CheckCircle2 size={16} />}{notice.text}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Competitors', value: competitors.length, icon: <Users size={18} />, color: 'from-blue-500 to-indigo-600' },
          { label: 'Still to forward', value: pendingForward.length, icon: <Send size={18} />, color: 'from-amber-400 to-orange-500' },
          { label: 'Assessment marks in', value: counts.assessed, icon: <Clock size={18} />, color: 'from-violet-500 to-purple-600' },
          { label: 'National video scored', value: counts.videoScored, icon: <Video size={18} />, color: 'from-emerald-500 to-green-600' },
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

      {pendingForward.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">Qualified, not forwarded yet (State Rank 1)</p>
          <div className="flex flex-wrap gap-2">
            {pendingForward.map(c => (
              <span key={c.olympiadCode} className="inline-flex flex-col px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[13px] font-bold text-gray-800">{c.name}</span>
                <span className="text-[11px] text-gray-500">{c.state || '—'} · State {c.stateHolisticPercent}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {['#', 'Student', 'State', 'Level 1 %', 'State video %', 'Virtual Assessment', 'National video', 'National %', ''].map(h => (
                  <th key={h} className="py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitors.length === 0 && (
                <tr><td colSpan={9} className="py-14 text-center text-gray-400 font-medium">Nobody has been forwarded to the National Level yet.</td></tr>
              )}
              {competitors.map((c, i) => {
                const m = marks[c.olympiadCode] ?? { score: c.assessment ? String(c.assessment.score) : '', max: c.assessment ? String(c.assessment.max) : '' };
                const dirty = !!marks[c.olympiadCode];
                const setM = (patch: Partial<typeof m>) => setMarks(prev => ({ ...prev, [c.olympiadCode]: { ...m, ...patch } }));
                return (
                  <tr key={c.olympiadCode} className="border-b border-gray-50 hover:bg-gray-50/60 align-top">
                    <td className="py-3 px-3 font-bold text-gray-400">{i + 1}</td>
                    <td className="py-3 px-3 max-w-[240px]">
                      <p className="font-bold text-gray-900 text-[13px]">{c.name}</p>
                      <p className="font-mono text-[11px] text-gray-500">{c.olympiadCode}{c.className ? ` · ${c.className}` : ''}</p>
                      <p className="text-[11px] text-gray-400 truncate" title={c.schoolName || ''}><School size={10} className="inline mr-1 -mt-0.5" />{c.schoolName || c.schoolCode || '—'}</p>
                    </td>
                    <td className="py-3 px-3 text-gray-700">{c.state || '—'}</td>
                    <td className="py-3 px-3 text-gray-700 font-semibold">{c.stage1Percent}%</td>
                    <td className="py-3 px-3 text-gray-700 font-semibold">{c.stateVideoPercent}%</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <input value={m.score} onChange={e => setM({ score: e.target.value })} inputMode="decimal" placeholder="marks"
                          className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-amber-300 outline-none" />
                        <span className="text-gray-400">/</span>
                        <input value={m.max} onChange={e => setM({ max: e.target.value })} inputMode="decimal" placeholder="max"
                          className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-amber-300 outline-none" />
                        {dirty && (
                          <button onClick={() => saveMarks(c)} disabled={busy !== null}
                            className="px-2.5 py-1 rounded-lg bg-[#06013E] text-[#F5E9C8] text-[11px] font-bold disabled:opacity-50 cursor-pointer">
                            {busy === `a:${c.olympiadCode}` ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        {c.assessment ? `${c.assessment.percent}% · saved ${fmtDate(c.assessment.enteredAt)}` : 'Not entered (0)'}
                      </p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${PROGRESS[c.videoProgress].cls}`}>{PROGRESS[c.videoProgress].label}</span>
                      {c.video?.totalScore !== null && c.video?.totalScore !== undefined && (
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{c.video.totalScore}/20 · {c.nationalVideoPercent}%</p>
                      )}
                      {!c.hasAppAccount && <p className="text-[10px] text-red-500 font-semibold mt-0.5">No app account</p>}
                    </td>
                    <td className="py-3 px-3 font-black text-gray-900 text-base">{c.nationalPercent}%</td>
                    <td className="py-3 px-3 text-right">
                      <button onClick={() => withdraw(c)} disabled={busy !== null}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
                        {busy === `w:${c.olympiadCode}` ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Withdraw
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Trophy size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-gray-700">
            <strong>National Winners</strong> ·{' '}
            {data.frozen.rows.length
              ? <>Frozen on <strong>{fmtDate(data.frozen.frozenAt)}</strong> · {data.frozen.rows.length} student{data.frozen.rows.length === 1 ? '' : 's'}</>
              : <>Not frozen yet. Top {data.topN} distinct National %s.</>}
          </p>
        </div>
        {data.frozen.rows.length > 0 && (
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
            {(['FROZEN', 'LIVE'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${view === v ? 'bg-[#06013E] text-[#F5E9C8]' : 'text-gray-500 hover:bg-white'}`}>
                {v === 'FROZEN' ? 'Frozen' : 'Live'}
              </button>
            ))}
          </div>
        )}
        {data.frozen.rows.length > 0 && (
          <button onClick={unfreeze} disabled={busy !== null || !data.tableReady}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
            <Undo2 size={15} /> Un-freeze
          </button>
        )}
        <button onClick={freeze} disabled={busy !== null || !data.tableReady || competitors.length === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#06013E] text-[#F5E9C8] text-sm font-bold shadow-md hover:bg-[#0a0258] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
          {busy === 'freeze' ? <Loader2 size={15} className="animate-spin" /> : data.frozen.rows.length ? <Lock size={15} /> : <Snowflake size={15} />}
          {data.frozen.rows.length ? 'Freeze again' : 'Freeze list'}
        </button>
      </div>

      {tiers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-12 text-center text-gray-400 font-medium">Nobody is on this list yet.</div>
      ) : (
        <ul className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {tiers.map(t => (
            <li key={t.rank} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <div className="flex items-center gap-2 w-28 flex-shrink-0">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-black ${RANK_STYLE[t.rank - 1] || RANK_STYLE[2]}`}>#{t.rank}</span>
                <span className="text-base font-black text-gray-900">{t.percent ?? '—'}%</span>
              </div>
              <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                {t.students.map(st => (
                  <span key={st.olympiadCode} className="inline-flex flex-col px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-[13px] font-bold text-gray-800">{st.name}</span>
                    <span className="font-mono text-[11px] text-gray-500">{st.olympiadCode}{st.className ? ` · ${st.className}` : ''}</span>
                    <span className="text-[11px] text-gray-400 truncate">
                      <School size={10} className="inline mr-1 -mt-0.5" />{st.schoolName || st.schoolCode || '—'}{st.state ? ` · ${st.state}` : ''}
                    </span>
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
