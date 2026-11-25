'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, Clock, EyeOff, Loader2, Lock, Search, Send, Smartphone, Users } from 'lucide-react';
import ResultPassportV2, { type PassportV2Student } from '@/components/ResultPassportV2';
import { CARD, STACK, INPUT, avatarTint, TABLE, TH, TD, TR, BTN_PRIMARY, BTN_SECONDARY } from '../ui';
import {
  PageHeader, StatTile, StatusBadge, Avatar, FilterPill,
  LoadingState, ErrorState, EmptyState, TableShell, RowCount,
} from '../components';

type PassportRow = PassportV2Student & {
  className: string | null;
  holisticPercent: number | null;
  status: 'Complete' | 'Incomplete';
  /** Since when the student can see this passport in the mittmee app. */
  inAppSince: string | null;
};

interface PassportsResponse {
  released: boolean;
  releasedAt: string | null;
  students: PassportRow[];
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function PassportsPage() {
  const [data, setData] = useState<PassportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [readyOnly, setReadyOnly] = useState(false);
  const [open, setOpen] = useState<PassportRow | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') || '' : '';

  useEffect(() => {
    fetch('/api/school/me/passports', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.message || 'Could not load passports')))
      .then(setData)
      .catch(e => setError(typeof e === 'string' ? e : 'Could not load passports'))
      .finally(() => setLoading(false));
  }, [token]);

  const students = useMemo(
    () => [...(data?.students ?? [])].sort((a, b) =>
      (a.className || '').localeCompare(b.className || '', undefined, { numeric: true }) || a.name.localeCompare(b.name)),
    [data],
  );
  const classes = useMemo(
    () => Array.from(new Set(students.map(s => s.className).filter((c): c is string => !!c)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [students],
  );
  const ready = students.filter(s => s.status === 'Complete').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s => {
      if (classFilter !== 'ALL' && s.className !== classFilter) return false;
      if (readyOnly && s.status !== 'Complete') return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.olympiadCode.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, search, classFilter, readyOnly]);

  const released = !!data?.released;
  const inAppCount = students.filter(s => s.inAppSince).length;

  // Select students (only ready passports), then send them all to the mittmee
  // app — or hide them — in one go.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<'show' | 'hide' | null>(null);
  const setMany = (codes: string[], on: boolean) => setSelected(prev => {
    const next = new Set(prev);
    for (const c of codes) { if (on) next.add(c); else next.delete(c); }
    return next;
  });
  const selectableShown = filtered.filter(s => s.status === 'Complete').map(s => s.olympiadCode);
  const allShownSelected = selectableShown.length > 0 && selectableShown.every(c => selected.has(c));
  const someShownSelected = selectableShown.some(c => selected.has(c));
  const selectedRows = students.filter(s => selected.has(s.olympiadCode));
  const toShow = selectedRows.filter(s => !s.inAppSince);
  const toHide = selectedRows.filter(s => s.inAppSince);

  const sendToApp = async (action: 'show' | 'hide') => {
    const target = action === 'show' ? toShow : toHide;
    if (target.length === 0) return;
    const n = target.length;
    const ok = window.confirm(action === 'show'
      ? `Show ${n} passport${n === 1 ? '' : 's'} in the mittmee app?\n\nThese students will be able to open their passport in the app.`
      : `Hide ${n} passport${n === 1 ? '' : 's'} from the mittmee app?\n\nThese students will no longer see it. You can still see them here.`);
    if (!ok) return;
    setSending(action);
    try {
      const codes = target.map(s => s.olympiadCode);
      const res = await fetch('/api/school/me/passports/student-release', {
        method: action === 'show' ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ olympiadCodes: codes }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message);
      const shown: Record<string, string> = action === 'show' ? body.shown ?? {} : {};
      const changed = new Set(codes);
      setData(d => d ? {
        ...d,
        students: d.students.map(r => !changed.has(r.olympiadCode) ? r
          : { ...r, inAppSince: action === 'show' ? shown[r.olympiadCode] ?? r.inAppSince : null }),
      } : d);
      setSelected(new Set());
      if (action === 'show' && Array.isArray(body.skipped) && body.skipped.length) {
        alert(`${n - body.skipped.length} shown. ${body.skipped.length} skipped:\n\n` +
          body.skipped.map((s: { olympiadCode: string; reason: string }) => `${s.olympiadCode}: ${s.reason}`).join('\n'));
      }
    } catch (e: any) {
      alert(e?.message || (action === 'show' ? 'Could not show the passports. Please try again.' : 'Could not hide the passports. Please try again.'));
    } finally {
      setSending(null);
    }
  };

  return (
    <div className={STACK}>
      <PageHeader
        icon={Award}
        title="Student Passports"
        subtitle="Each child's Holistic Progress Passport. Open one to read it, or download it as a PDF to share with parents."
      />

      {loading ? (
        <LoadingState label="Loading passports…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : !released ? (
        <EmptyState
          icon={Lock}
          title="Passports aren't released yet"
          hint="They appear here as soon as the results are released to your school. You'll find every completed student's passport on this page."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Students" value={students.length} icon={Users} />
            <StatTile label="Passports ready" value={ready} icon={CheckCircle2} />
            <StatTile label="Not ready yet" value={students.length - ready} icon={Clock} />
            <StatTile label="Shown in student app" value={inAppCount} icon={Smartphone} />
          </div>

          <div className={`${CARD} flex flex-wrap items-center gap-2 px-3 py-2.5`}>
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A1B2]" size={13} />
              <input
                type="text" placeholder="Search name or Olympiad ID" aria-label="Search students"
                value={search} onChange={e => setSearch(e.target.value)} className={`${INPUT} pl-8`}
              />
            </div>
            <FilterPill active={readyOnly} onClick={() => setReadyOnly(v => !v)}>Ready only</FilterPill>
            {classes.length > 0 && (
              <select
                value={classFilter} onChange={e => setClassFilter(e.target.value)} aria-label="Filter by class"
                className={`${INPUT} ml-auto !w-auto !py-1.5`}
              >
                <option value="ALL">All classes</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {/* Student app: one action for every selected student */}
          <div className={`${CARD} flex flex-wrap items-center gap-2 px-3.5 py-2.5 ${selected.size ? '!border-[#9FD8B4] !bg-[#F1FAF4]' : ''}`}>
            <Smartphone size={15} className={selected.size ? 'text-[#0E7C3A]' : 'text-[#98A1B2]'} />
            {selected.size === 0 ? (
              <p className="text-[12.5px] text-[#677285]">
                Tick the students whose passport you want to send to the mittmee app.
                {inAppCount > 0 && <> <span className="font-medium text-[#0E7C3A]">{inAppCount} already in the app.</span></>}
              </p>
            ) : (
              <>
                <p className="text-[12.5px] font-semibold text-[#0E7C3A]">{selected.size} selected</p>
                <button onClick={() => setSelected(new Set())} className="text-[12px] font-medium text-[#677285] hover:text-[#0F1B2D] hover:underline cursor-pointer">
                  Clear
                </button>
                <div className="ml-auto flex items-center gap-2">
                  {toHide.length > 0 && (
                    <button onClick={() => sendToApp('hide')} disabled={sending !== null} className={`${BTN_SECONDARY} !py-1.5`}>
                      {sending === 'hide' ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />} Hide from app ({toHide.length})
                    </button>
                  )}
                  <button
                    onClick={() => sendToApp('show')} disabled={sending !== null || toShow.length === 0}
                    title={toShow.length === 0 ? 'All selected students can already see their passport' : undefined}
                    className={`${BTN_PRIMARY} !py-1.5`}
                  >
                    {sending === 'show' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send to student app ({toShow.length})
                  </button>
                </div>
              </>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Award} title={students.length === 0 ? 'No students yet' : 'No students match your filters'} />
          ) : (
            <TableShell footer={<RowCount shown={filtered.length} total={students.length} noun="students" />}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={`${TH} w-8`}>
                      <input
                        type="checkbox"
                        checked={allShownSelected}
                        ref={el => { if (el) el.indeterminate = someShownSelected && !allShownSelected; }}
                        disabled={selectableShown.length === 0}
                        onChange={() => setMany(selectableShown, !allShownSelected)}
                        className="h-4 w-4 cursor-pointer accent-[#1559C7] disabled:cursor-not-allowed"
                        aria-label="Select all ready passports shown"
                        title="Select all ready passports in this list"
                      />
                    </th>
                    <th className={TH}>Student</th>
                    <th className={TH}>Class</th>
                    <th className={TH}>Holistic score</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Passport</th>
                    <th className={TH}>Student app</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.studentKey} className={`${TR} ${selected.has(s.olympiadCode) ? 'bg-[#F1FAF4]' : ''}`}>
                      <td className={TD}>
                        <input
                          type="checkbox"
                          checked={selected.has(s.olympiadCode)}
                          disabled={s.status !== 'Complete'}
                          onChange={e => setMany([s.olympiadCode], e.target.checked)}
                          className="h-4 w-4 cursor-pointer accent-[#1559C7] disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Select ${s.name}`}
                          title={s.status !== 'Complete' ? 'Passport not ready yet' : undefined}
                        />
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          <Avatar name={s.name} tint={avatarTint(i)} size={26} />
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-[#0F1B2D]">{s.name}</p>
                            <p className="truncate font-mono text-[11px] font-medium text-[#1559C7]">{s.olympiadCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className={TD}>{s.className || <span className="text-[#98A1B2]">—</span>}</td>
                      <td className={`${TD} font-semibold`}>
                        {s.status === 'Complete' && s.holisticPercent !== null ? `${s.holisticPercent}%` : <span className="text-[#98A1B2]">—</span>}
                      </td>
                      <td className={TD}>
                        {s.status === 'Complete'
                          ? <StatusBadge tone="success" icon={CheckCircle2}>Ready</StatusBadge>
                          : <StatusBadge tone="neutral" icon={Clock}>Not ready yet</StatusBadge>}
                      </td>
                      <td className={TD}>
                        {s.status === 'Complete' ? (
                          <button onClick={() => setOpen(s)} className={BTN_PRIMARY} aria-label={`Open passport for ${s.name}`}>
                            <BookOpen size={13} /> Open
                          </button>
                        ) : <span className="text-[11.5px] text-[#98A1B2]">Result pending</span>}
                      </td>
                      <td className={TD}>
                        {s.inAppSince ? (
                          <StatusBadge tone="success" icon={Smartphone}>In app since {fmtDate(s.inAppSince)}</StatusBadge>
                        ) : (
                          <span className="text-[11.5px] text-[#98A1B2]">{s.status === 'Complete' ? 'Not sent' : '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </>
      )}

      {open && <ResultPassportV2 student={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
