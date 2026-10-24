'use client';

import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, CheckCircle2, Clock, Lock, Search, Users } from 'lucide-react';
import ResultPassportV2, { type PassportV2Student } from '@/components/ResultPassportV2';
import { CARD, STACK, INPUT, avatarTint, TABLE, TH, TD, TR, BTN_PRIMARY } from '../ui';
import {
  PageHeader, StatTile, StatusBadge, Avatar, FilterPill,
  LoadingState, ErrorState, EmptyState, TableShell, RowCount,
} from '../components';

type PassportRow = PassportV2Student & {
  className: string | null;
  holisticPercent: number | null;
  status: 'Complete' | 'Incomplete';
};

interface PassportsResponse {
  released: boolean;
  releasedAt: string | null;
  students: PassportRow[];
}

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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Students" value={students.length} icon={Users} />
            <StatTile label="Passports ready" value={ready} icon={CheckCircle2} />
            <StatTile label="Not ready yet" value={students.length - ready} icon={Clock} />
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

          {filtered.length === 0 ? (
            <EmptyState icon={Award} title={students.length === 0 ? 'No students yet' : 'No students match your filters'} />
          ) : (
            <TableShell footer={<RowCount shown={filtered.length} total={students.length} noun="students" />}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Student</th>
                    <th className={TH}>Class</th>
                    <th className={TH}>Holistic score</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Passport</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.studentKey} className={TR}>
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
