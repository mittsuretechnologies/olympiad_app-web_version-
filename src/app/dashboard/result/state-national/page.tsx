'use client';

import { Fragment, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle, Award, CheckCircle2, ChevronDown, ChevronUp, Clock, Download, Loader2, Lock, MapPin, School,
  Search, Snowflake, Trophy, Undo2, Users, Video,
} from 'lucide-react';
import { fetcher, authFetch } from '@/lib/swr';

// Result → State & National (lib/state-result.ts): every State Level
// competitor's State Holistic %, the State Toppers (per state, top 3 distinct
// %s) and the National Winners (all states, top 3 distinct %s). Each list can
// be frozen: the saved copy stays as it was while the live list keeps moving.

type Level = 'STATE' | 'NATIONAL';
type Tab = 'COMPETITORS' | Level;

interface KoshRow { kosh: string; label: string; stage1Percent: number | null; stateVideoPercent: number | null; finalPercent: number }
interface Competitor {
  olympiadCode: string; name: string; className: string | null; schoolName: string | null; schoolCode: string | null;
  district: string | null; state: string | null; forwardedAt: string; examSource: 'manual' | 'ai';
  stage1HolisticPercent: number;
  video: { id: string; status: string; subCategory: string | null; evaluated: boolean; published: boolean; totalScore: number | null } | null;
  progress: 'NO_VIDEO' | 'AWAITING_MARKS' | 'SCORED';
  kosh: KoshRow[];
  stateHolisticPercent: number;
}
interface Tier { rank: number; stateHolisticPercent: number; students: Competitor[] }
interface FrozenRow {
  id: string; level: Level; rank: number; olympiadCode: string; name: string; className: string | null;
  schoolName: string | null; schoolCode: string | null; district: string | null; state: string | null;
  stateHolisticPercent: number; stage1HolisticPercent: number | null; frozenAt: string;
}
interface Response {
  stateTopN: number; nationalTopN: number; tableReady: boolean;
  competitors: Competitor[];
  stateToppers: { states: { state: string; competitors: number; tiers: Tier[] }[]; noState: number };
  nationalWinners: Tier[];
  frozen: Record<Level, { frozenAt: string | null; rows: FrozenRow[] }>;
}

/** One student on a list, live or frozen. */
interface ListStudent {
  olympiadCode: string; name: string; className: string | null; schoolName: string | null; schoolCode: string | null;
  district: string | null; state: string | null; stateHolisticPercent: number;
}
interface ListTier { rank: number; percent: number; students: ListStudent[] }
interface ListGroup { title: string | null; subtitle: string | null; tiers: ListTier[] }

const RANK_STYLE = [
  'bg-amber-50 border-amber-200 text-amber-800',
  'bg-slate-50 border-slate-200 text-slate-700',
  'bg-orange-50 border-orange-200 text-orange-800',
];
const PROGRESS: Record<Competitor['progress'], { label: string; cls: string }> = {
  SCORED: { label: 'Scored', cls: 'bg-green-50 border-green-200 text-green-700' },
  AWAITING_MARKS: { label: 'Awaiting marks', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  NO_VIDEO: { label: 'No video (0)', cls: 'bg-gray-50 border-gray-200 text-gray-500' },
};
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

/** Groups a flat frozen list back into tiers (and states). */
function groupFrozen(rows: FrozenRow[], byState: boolean): ListGroup[] {
  const tiersOf = (list: FrozenRow[]): ListTier[] => {
    const m = new Map<number, ListTier>();
    for (const r of list) {
      const t = m.get(r.rank) || m.set(r.rank, { rank: r.rank, percent: r.stateHolisticPercent, students: [] }).get(r.rank)!;
      t.students.push(r);
    }
    return Array.from(m.values()).sort((a, b) => a.rank - b.rank);
  };
  if (!byState) return [{ title: null, subtitle: null, tiers: tiersOf(rows) }];
  const states = new Map<string, FrozenRow[]>();
  for (const r of rows) (states.get(r.state || '—') || states.set(r.state || '—', []).get(r.state || '—')!).push(r);
  return Array.from(states.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([state, list]) => ({ title: state, subtitle: null, tiers: tiersOf(list) }));
}

export default function StateNationalPage() {
  const { data, error, isLoading, mutate } = useSWR<Response>('/api/result/state-national', fetcher, { revalidateOnFocus: false });
  const [tab, setTab] = useState<Tab>('COMPETITORS');
  const [view, setView] = useState<'LIVE' | 'FROZEN'>('FROZEN');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const competitors = useMemo(() => data?.competitors ?? [], [data]);
  const counts = useMemo(() => ({
    scored: competitors.filter(c => c.progress === 'SCORED').length,
    awaiting: competitors.filter(c => c.progress === 'AWAITING_MARKS').length,
    noVideo: competitors.filter(c => c.progress === 'NO_VIDEO').length,
  }), [competitors]);

  const q = search.trim().toLowerCase();
  const matches = (s: { name: string; olympiadCode: string; schoolName: string | null; state: string | null; district: string | null }) =>
    !q || [s.name, s.olympiadCode, s.schoolName, s.state, s.district].some(v => (v || '').toLowerCase().includes(q));

  const level: Level | null = tab === 'COMPETITORS' ? null : tab;
  const frozen = level && data ? data.frozen[level] : null;
  const showFrozen = !!frozen?.rows.length && view === 'FROZEN';

  // The list shown on a toppers tab: the frozen copy, or the live one.
  const groups: ListGroup[] = useMemo(() => {
    if (!data || !level) return [];
    if (showFrozen) return groupFrozen(data.frozen[level].rows, level === 'STATE');
    const toList = (tiers: Tier[]): ListTier[] =>
      tiers.map(t => ({ rank: t.rank, percent: t.stateHolisticPercent, students: t.students }));
    return level === 'NATIONAL'
      ? [{ title: null, subtitle: null, tiers: toList(data.nationalWinners) }]
      : data.stateToppers.states.map(s => ({
          title: s.state, subtitle: `${s.competitors} competitor${s.competitors === 1 ? '' : 's'}`, tiers: toList(s.tiers),
        }));
  }, [data, level, showFrozen]);

  const filteredGroups = groups
    .map(g => ({ ...g, tiers: g.tiers.map(t => ({ ...t, students: t.students.filter(matches) })).filter(t => t.students.length) }))
    .filter(g => g.tiers.length);
  const filteredCompetitors = competitors.filter(matches);

  const call = async (key: string, method: 'POST' | 'DELETE', body: object) => {
    setBusy(key); setNotice(null);
    try {
      const res = await authFetch('/api/result/state-national', {
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

  const freeze = async (lv: Level) => {
    const name = lv === 'NATIONAL' ? 'National Winners' : 'State Toppers';
    const pending = counts.awaiting + counts.noVideo;
    const warn = pending ? `\n\n${pending} competitor${pending === 1 ? ' is' : 's are'} not scored yet and count 0 on the State video side.` : '';
    const again = data?.frozen[lv].rows.length ? '\n\nThe list frozen earlier will be replaced.' : '';
    if (!window.confirm(`Freeze the ${name} list as it is right now?${warn}${again}`)) return;
    const j = await call(lv, 'POST', { level: lv });
    if (j) { setView('FROZEN'); setNotice({ ok: true, text: `${name} frozen: ${j.frozen} student${j.frozen === 1 ? '' : 's'}.` }); }
  };
  const unfreeze = async (lv: Level) => {
    const name = lv === 'NATIONAL' ? 'National Winners' : 'State Toppers';
    if (!window.confirm(`Un-freeze ${name}? The saved list is removed; the live list stays.`)) return;
    const j = await call(lv, 'DELETE', { level: lv });
    if (j) setNotice({ ok: true, text: `${name} un-frozen.` });
  };

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let rows: unknown[][];
    if (tab === 'COMPETITORS') {
      rows = [
        ['Student', 'Olympiad ID', 'Class', 'School', 'School ID', 'District', 'State', 'Stage-1 Holistic %', 'Exam marks',
          'State video', ...competitors[0]?.kosh.map(k => `${k.label} final %`) ?? [], 'State Holistic %'],
        ...filteredCompetitors.map(c => [c.name, c.olympiadCode, c.className, c.schoolName, c.schoolCode, c.district, c.state,
          c.stage1HolisticPercent, c.examSource === 'ai' ? 'AI' : 'Manual', PROGRESS[c.progress].label,
          ...c.kosh.map(k => k.finalPercent), c.stateHolisticPercent]),
      ];
    } else {
      rows = [
        [...(tab === 'STATE' ? ['State'] : []), 'Rank', 'State Holistic %', 'Student', 'Olympiad ID', 'Class', 'School', 'School ID', 'District', 'State'],
        ...filteredGroups.flatMap(g => g.tiers.flatMap(t => t.students.map(s => [
          ...(tab === 'STATE' ? [g.title] : []), t.rank, t.percent, s.name, s.olympiadCode, s.className, s.schoolName, s.schoolCode, s.district, s.state,
        ]))),
      ];
    }
    const name = tab === 'COMPETITORS' ? 'state-level-result' : tab === 'STATE' ? 'state-toppers' : 'national-winners';
    const url = URL.createObjectURL(new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${name}${showFrozen ? '-frozen' : ''}-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#009846]" />
          <p className="text-gray-500 font-medium">Building the State Level result…</p>
        </div>
      </div>
    );
  }
  if (error || !data) {
    return <div className="bg-white rounded-2xl border border-red-100 shadow-sm py-10 text-center text-red-500 font-medium">Could not load the State Level result. Please refresh.</div>;
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'COMPETITORS', label: `Competitors (${competitors.length})` },
    { key: 'STATE', label: 'State Toppers' },
    { key: 'NATIONAL', label: 'National Winners' },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">State &amp; National</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Each kosha: (stage-1 % + State video %) ÷ 2. State Holistic % = average of the 5. No State video or no published marks counts 0.
          </p>
        </div>
        <button onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {!data.tableReady && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <span>The CompetitionWinner table has not been created yet (2026-11-17-competition-winners.sql), so freezing is switched off. The live lists below still work.</span>
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
          { label: 'Scored', value: counts.scored, icon: <CheckCircle2 size={18} />, color: 'from-emerald-500 to-green-600' },
          { label: 'Awaiting marks', value: counts.awaiting, icon: <Clock size={18} />, color: 'from-amber-400 to-orange-500' },
          { label: 'No State video', value: counts.noVideo, icon: <Video size={18} />, color: 'from-gray-400 to-gray-500' },
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

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setOpen(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors cursor-pointer ${
              tab === t.key ? 'bg-[#06013E] text-[#F5E9C8] border-[#06013E]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}>
            {t.key === 'NATIONAL' ? <Trophy size={14} className="inline mr-1.5 -mt-0.5" /> : t.key === 'STATE' ? <Award size={14} className="inline mr-1.5 -mt-0.5" /> : null}
            {t.label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student, ID, school, state…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 outline-none" />
        </div>
      </div>

      {/* ── Competitors ─────────────────────────────────────────────────── */}
      {tab === 'COMPETITORS' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  {['#', 'Student', 'School', 'State', 'Stage-1 %', 'State video', 'State Holistic %', ''].map(h => (
                    <th key={h} className="py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCompetitors.length === 0 && (
                  <tr><td colSpan={8} className="py-14 text-center text-gray-400 font-medium">
                    {competitors.length === 0 ? 'Nobody has been forwarded to the State Level yet (Result → State Level).' : 'No competitors match.'}
                  </td></tr>
                )}
                {filteredCompetitors.map((c, i) => {
                  const isOpen = open === c.olympiadCode;
                  return (
                    <Fragment key={c.olympiadCode}>
                      <tr className="border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer" onClick={() => setOpen(isOpen ? null : c.olympiadCode)}>
                        <td className="py-3 px-3 font-bold text-gray-400">{i + 1}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-gray-900 text-[13px]">{c.name}</p>
                          <p className="font-mono text-[11px] text-gray-500">{c.olympiadCode}{c.className ? ` · ${c.className}` : ''}</p>
                        </td>
                        <td className="py-3 px-3 max-w-[220px]">
                          <p className="text-[13px] text-gray-700 truncate" title={c.schoolName || ''}><School size={12} className="inline mr-1 -mt-0.5 text-gray-400" />{c.schoolName || '—'}</p>
                          <p className="text-[11px] text-gray-400">{c.district || ''}</p>
                        </td>
                        <td className="py-3 px-3 text-gray-700">{c.state || <span className="text-amber-700 font-semibold">Not set</span>}</td>
                        <td className="py-3 px-3 text-gray-700 font-semibold">
                          {c.stage1HolisticPercent}%
                          <p className="text-[10px] text-gray-400 font-semibold">{c.examSource === 'ai' ? 'AI' : 'Manual'} exam</p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${PROGRESS[c.progress].cls}`}>{PROGRESS[c.progress].label}</span>
                          {c.video?.totalScore !== null && c.video?.totalScore !== undefined && (
                            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{c.video.totalScore}/20</p>
                          )}
                        </td>
                        <td className="py-3 px-3 font-black text-gray-900 text-base">{c.stateHolisticPercent}%</td>
                        <td className="py-3 px-3 text-gray-400">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50/60 border-b border-gray-100">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              {c.kosh.map(k => (
                                <div key={k.kosh} className="bg-white rounded-xl border border-gray-100 px-3 py-2">
                                  <p className="text-[10px] font-bold text-[#004f9f] uppercase tracking-wide">{k.label}</p>
                                  <p className="text-lg font-black text-gray-900">{k.finalPercent}%</p>
                                  <p className="text-[10.5px] text-gray-500">
                                    ({k.stage1Percent ?? 0}% stage-1 + {k.stateVideoPercent ?? 0}% State) ÷ 2
                                  </p>
                                </div>
                              ))}
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
        </div>
      )}

      {/* ── State Toppers / National Winners ────────────────────────────── */}
      {level && frozen && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {frozen.rows.length ? <Lock size={16} className="text-[#004f9f] flex-shrink-0" /> : <Snowflake size={16} className="text-gray-400 flex-shrink-0" />}
              <p className="text-sm text-gray-700">
                {frozen.rows.length
                  ? <>Frozen on <strong>{fmtDate(frozen.frozenAt)}</strong> · {frozen.rows.length} student{frozen.rows.length === 1 ? '' : 's'}</>
                  : <>Not frozen yet. {level === 'NATIONAL' ? `Top ${data.nationalTopN} distinct %s across all states.` : `Top ${data.stateTopN} distinct %s in each state.`}</>}
              </p>
            </div>
            {frozen.rows.length > 0 && (
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
                {(['FROZEN', 'LIVE'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${view === v ? 'bg-[#06013E] text-[#F5E9C8]' : 'text-gray-500 hover:bg-white'}`}>
                    {v === 'FROZEN' ? 'Frozen' : 'Live'}
                  </button>
                ))}
              </div>
            )}
            {frozen.rows.length > 0 && (
              <button onClick={() => unfreeze(level)} disabled={busy !== null || !data.tableReady}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
                <Undo2 size={15} /> Un-freeze
              </button>
            )}
            <button onClick={() => freeze(level)} disabled={busy !== null || !data.tableReady}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#06013E] text-[#F5E9C8] text-sm font-bold shadow-md hover:bg-[#0a0258] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {busy === level ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              {frozen.rows.length ? 'Freeze again' : 'Freeze list'}
            </button>
          </div>

          {level === 'STATE' && !showFrozen && data.stateToppers.noState > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{data.stateToppers.noState} competitor{data.stateToppers.noState === 1 ? '' : 's'} left out: their school has no state set.</span>
            </div>
          )}

          {filteredGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center text-gray-400 font-medium">
              {groups.length === 0 ? 'Nobody is on this list yet.' : 'No students match.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map(g => (
                <div key={g.title ?? 'all'} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {g.title && (
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 bg-gray-50/60">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0">
                        <MapPin size={16} />
                      </div>
                      <p className="font-extrabold text-gray-900 text-[14px] truncate flex-1 min-w-0">{g.title}</p>
                      {g.subtitle && <span className="text-[11px] font-semibold text-gray-500">{g.subtitle}</span>}
                    </div>
                  )}
                  <ul className="divide-y divide-gray-50">
                    {g.tiers.map(t => (
                      <li key={t.rank} className="flex flex-wrap items-start gap-3 px-4 py-3">
                        <div className="flex items-center gap-2 w-28 flex-shrink-0">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-black ${RANK_STYLE[t.rank - 1] || RANK_STYLE[2]}`}>#{t.rank}</span>
                          <span className="text-base font-black text-gray-900">{t.percent}%</span>
                        </div>
                        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                          {t.students.map(st => (
                            <span key={st.olympiadCode} className="inline-flex flex-col px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                              <span className="text-[13px] font-bold text-gray-800">{st.name}</span>
                              <span className="font-mono text-[11px] text-gray-500">{st.olympiadCode}{st.className ? ` · ${st.className}` : ''}</span>
                              <span className="text-[11px] text-gray-400 truncate">
                                <School size={10} className="inline mr-1 -mt-0.5" />{st.schoolName || st.schoolCode || '—'}
                                {level === 'NATIONAL' && st.state ? ` · ${st.state}` : ''}
                              </span>
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
        </>
      )}
    </div>
  );
}
