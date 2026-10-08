'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Clock, Download, FileSignature, Loader2,
  RefreshCw, Search, Shield, Users, X, ChevronLeft, ChevronRight,
  Building2, Calendar, User, Fingerprint, ShieldCheck, RotateCcw,
} from 'lucide-react';

/**
 * Superadmin — Agreement Acceptance Register, one tab per role:
 *   Schools    — School Onboarding Agreement, with full legal metadata per row
 *   Moderators — first-login Terms & Conditions (acceptance time only)
 * CSV export with all rows is available for both.
 */

/* ── Types ───────────────────────────────────────────────────────────────── */

interface Acceptance {
  id: string; signatoryName: string; signatoryDesignation: string;
  documentVersion: string; acceptedAt: string; ipAddress: string | null;
  verificationChannel: string; emailCopyTo: string | null; emailCopySentAt: string | null;
  details: Record<string, string>; declarations: string[];
}

interface SchoolRow {
  school: { id: string; schoolId: string; name: string; city: string | null; state: string | null; email: string | null; isActive: boolean };
  acceptance: Acceptance | null;
  /** Set when a SuperAdmin asked this school to accept again and it hasn't yet. */
  reaccept: { requestedAt: string; reason: string | null; previousAcceptedAt: string } | null;
}

interface Summary { total: number; accepted: number; pending: number; orphaned: number }

interface ApiResponse {
  summary: Summary; rows: SchoolRow[]; total: number;
  page: number; pageSize: number; totalPages: number;
  currentVersion: string;
}

interface ModeratorRow {
  moderator: { id: string; moderatorId: string; name: string; email: string; isActive: boolean; createdAt: string };
  accepted: boolean;
  acceptedAt: string | null;
}

interface ModeratorResponse {
  summary: Summary; rows: ModeratorRow[]; total: number;
  page: number; pageSize: number; totalPages: number;
}

type Role = 'SCHOOL' | 'MODERATOR';

const ROLES: { key: Role; label: string; icon: typeof Users; document: string; noun: string }[] = [
  { key: 'SCHOOL', label: 'Schools', icon: Building2, document: 'School Onboarding Agreement', noun: 'schools' },
  { key: 'MODERATOR', label: 'Moderators', icon: ShieldCheck, document: 'Terms and Conditions', noun: 'moderators' },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

const getToken = () =>
  typeof window !== 'undefined' ? sessionStorage.getItem('token') ?? '' : '';

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AgreementsPage() {
  const [role, setRole] = useState<Role>('SCHOOL');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [modData, setModData] = useState<ModeratorResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ok'>('loading');
  const [filter, setFilter] = useState<'all' | 'accepted' | 'pending'>('all');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // "Ask to accept again": revokes the current acceptance (kept as evidence)
  // so the school sees the agreement gate again and re-accepts.
  const [reaccept, setReaccept] = useState<{ acceptance: Acceptance; school: SchoolRow['school'] } | null>(null);
  const [reason, setReason] = useState('');
  const [reacceptBusy, setReacceptBusy] = useState(false);
  const [reacceptError, setReacceptError] = useState('');

  const openReaccept = (acceptance: Acceptance, school: SchoolRow['school']) => {
    setReason(''); setReacceptError(''); setReaccept({ acceptance, school });
  };
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    debounceRef.current = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const params = new URLSearchParams({ role, status: filter, q: debouncedQ, page: String(page), pageSize: '25' });
      const res = await fetch(`/api/dashboard/agreements?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (role === 'MODERATOR') setModData(json); else setData(json);
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, [role, filter, debouncedQ, page]);

  const switchRole = (r: Role) => {
    if (r === role) return;
    setRole(r); setFilter('all'); setQ(''); setDebouncedQ(''); setPage(1); setExpanded(null);
  };

  const roleMeta = ROLES.find(r => r.key === role)!;
  const current = role === 'MODERATOR' ? modData : data;

  useEffect(() => { load(); }, [load]);

  const confirmReaccept = async () => {
    if (!reaccept) return;
    setReacceptBusy(true); setReacceptError('');
    try {
      const res = await fetch(`/api/dashboard/agreements/${reaccept.acceptance.id}/request-reacceptance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Could not request re-acceptance.');
      setReaccept(null);
      setExpanded(null);
      load();
    } catch (e: any) {
      setReacceptError(e.message);
    } finally {
      setReacceptBusy(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ role, status: filter, q: debouncedQ, all: '1' });
      const res = await fetch(`/api/dashboard/agreements?${params}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error();
      const quote = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
      const download = (csv: string, name: string) => {
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
      };
      if (role === 'MODERATOR') {
        const json: ModeratorResponse = await res.json();
        const cols = ['Moderator ID', 'Name', 'Email', 'Account', 'Status', 'Accepted At (IST)'];
        const lines = json.rows.map(({ moderator, accepted, acceptedAt }) => [
          moderator.moderatorId, moderator.name, moderator.email,
          moderator.isActive ? 'Active' : 'Inactive',
          accepted ? 'Accepted' : 'Pending',
          acceptedAt ? fmt(acceptedAt) : '',
        ].map(quote).join(','));
        download([cols.join(','), ...lines].join('\n'), 'moderator-terms');
        return;
      }
      const json: ApiResponse = await res.json();
      const cols = ['School Code', 'School Name', 'City', 'State', 'Status', 'Version', 'Accepted At (IST)', 'Signatory', 'Designation', 'IP Address', 'Verification', 'Email Copy Sent To', 'Re-acceptance Requested At (IST)'];
      const lines = json.rows.map(({ school, acceptance, reaccept }) => [
        school.schoolId, school.name, school.city ?? '', school.state ?? '',
        acceptance ? 'Accepted' : 'Pending',
        acceptance?.documentVersion ?? '',
        acceptance ? fmt(acceptance.acceptedAt) : '',
        acceptance?.signatoryName ?? '',
        acceptance?.signatoryDesignation ?? '',
        acceptance?.ipAddress ?? '',
        acceptance?.verificationChannel ?? '',
        acceptance?.emailCopyTo ?? '',
        reaccept ? fmt(reaccept.requestedAt) : '',
      ].map(quote).join(','));
      download([cols.join(','), ...lines].join('\n'), 'agreements');
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#1559C7]/10 flex items-center justify-center flex-shrink-0">
            <FileSignature size={18} className="text-[#1559C7]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold text-[#0E2A5C] leading-tight">Agreement Register</h1>
            <p className="text-[12px] text-[#6B7280] mt-0.5">
              {roleMeta.document} — acceptance records{role === 'SCHOOL' && data ? ` · v${data.currentVersion}` : ''}
            </p>
          </div>
        </div>
        <div className="sm:ml-auto flex items-center gap-2 flex-shrink-0">
          <button onClick={load} disabled={status === 'loading'} title="Refresh" className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-[#E4E8EE] bg-white hover:bg-[#F3F5F8] disabled:opacity-50 transition-colors">
            <RefreshCw size={15} className={status === 'loading' ? 'animate-spin text-[#1559C7]' : 'text-[#6B7280]'} />
          </button>
          <button onClick={exportCsv} disabled={exporting || status !== 'ok'} className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[#E4E8EE] bg-white hover:bg-[#F3F5F8] disabled:opacity-50 text-[13px] font-medium text-[#374151] transition-colors">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export CSV
          </button>
        </div>
      </div>

      {/* Role tabs */}
      <div role="tablist" aria-label="Role" className="flex items-center gap-1 border-b border-[#E4E8EE] overflow-x-auto">
        {ROLES.map(r => {
          const active = r.key === role;
          return (
            <button
              key={r.key}
              role="tab"
              aria-selected={active}
              onClick={() => switchRole(r.key)}
              className={`-mb-px inline-flex items-center gap-2 h-10 px-3.5 border-b-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
                active ? 'border-[#1559C7] text-[#1559C7]' : 'border-transparent text-[#6B7280] hover:text-[#0E2A5C]'
              }`}
            >
              <r.icon size={15} /> {r.label}
              <span className={`hidden sm:inline text-[11px] font-normal ${active ? 'text-[#1559C7]/70' : 'text-[#9CA3AF]'}`}>{r.document}</span>
            </button>
          );
        })}
      </div>

      {/* Summary cards */}
      {current && (
        <div className={`grid grid-cols-2 gap-3 ${role === 'SCHOOL' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {[
            { label: `Total ${roleMeta.noun}`, value: current.summary.total, icon: Users, color: 'text-[#1559C7]', bg: 'bg-[#1559C7]/[0.06]', title: undefined as string | undefined },
            { label: 'Accepted', value: current.summary.accepted, icon: CheckCircle2, color: 'text-[#047857]', bg: 'bg-[#047857]/[0.06]', title: undefined },
            { label: 'Pending', value: current.summary.pending, icon: Clock, color: 'text-[#B45309]', bg: 'bg-[#B45309]/[0.06]', title: undefined },
            ...(role === 'SCHOOL'
              ? [{ label: 'Orphaned records', value: current.summary.orphaned, icon: Shield, color: 'text-[#6B7280]', bg: 'bg-[#6B7280]/[0.06]', title: 'Accepted by schools whose accounts have since been deleted' }]
              : []),
          ].map(card => (
            <div key={card.label} title={card.title} className="rounded-xl border border-[#E4E8EE] bg-white p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                <card.icon size={18} className={card.color} />
              </div>
              <div className="min-w-0">
                <p className="text-[22px] font-bold text-[#0E2A5C] leading-tight tabular-nums">{card.value.toLocaleString()}</p>
                <p className="text-[12px] text-[#6B7280] truncate">{card.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={role === 'SCHOOL' ? 'Search school name, code, city…' : 'Search moderator name, ID, email…'}
            className="w-full h-9 rounded-lg border border-[#E4E8EE] bg-white pl-8 pr-3 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#1559C7] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[#E4E8EE] bg-white p-1">
          {(['all', 'accepted', 'pending'] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className={`h-7 px-3 rounded-md text-[12.5px] font-medium transition-colors ${filter === f ? 'bg-[#1559C7] text-white' : 'text-[#4B5563] hover:bg-[#F3F5F8]'}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {status === 'loading' && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-[#1559C7]" size={24} />
        </div>
      )}
      {status === 'error' && (
        <div className="rounded-xl border border-[#E4E8EE] bg-white p-8 text-center">
          <AlertCircle size={24} className="mx-auto text-[#B91C1C]" />
          <p className="mt-2 text-[14px] font-semibold text-[#0E2A5C]">Failed to load records</p>
          <button onClick={load} className="mt-3 inline-flex items-center gap-2 text-[13px] text-[#1559C7] hover:underline">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}
      {status === 'ok' && role === 'MODERATOR' && modData && (
        <>
          {modData.rows.length === 0 ? (
            <div className="rounded-xl border border-[#E4E8EE] bg-white p-10 text-center text-[14px] text-[#6B7280]">
              No moderators match the current filter.
            </div>
          ) : (
            <div className="rounded-xl border border-[#E4E8EE] bg-white overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E4E8EE] bg-[#F8FAFC]">
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Moderator</th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] hidden sm:table-cell">Email</th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] hidden md:table-cell">Accepted at</th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] hidden lg:table-cell">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F5F8]">
                  {modData.rows.map(({ moderator, accepted, acceptedAt }) => (
                    <tr key={moderator.id} className="align-top hover:bg-[#FAFBFC] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0E2A5C] leading-tight">{moderator.name}</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">{moderator.moderatorId}</p>
                      </td>
                      <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell break-all">{moderator.email}</td>
                      <td className="px-4 py-3">
                        {accepted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#047857]/[0.08] px-2 py-0.5 text-[11.5px] font-semibold text-[#047857]">
                            <CheckCircle2 size={11} /> Accepted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#B45309]/[0.08] px-2 py-0.5 text-[11.5px] font-semibold text-[#B45309]">
                            <Clock size={11} /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#6B7280] hidden md:table-cell">{acceptedAt ? fmt(acceptedAt) : '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`text-[12px] font-medium ${moderator.isActive ? 'text-[#374151]' : 'text-[#9CA3AF]'}`}>
                          {moderator.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11.5px] text-[#9CA3AF]">
            Moderators accept the Terms and Conditions once, at first login. The record holds the date and time of acceptance.
          </p>
        </>
      )}

      {status === 'ok' && role === 'SCHOOL' && data && (
        <>
          {data.rows.length === 0 ? (
            <div className="rounded-xl border border-[#E4E8EE] bg-white p-10 text-center text-[14px] text-[#6B7280]">
              No schools match the current filter.
            </div>
          ) : (
            <div className="rounded-xl border border-[#E4E8EE] bg-white overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#E4E8EE] bg-[#F8FAFC]">
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">School</th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] hidden sm:table-cell">Location</th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] hidden md:table-cell">Accepted by</th>
                    <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] hidden lg:table-cell">Date &amp; time</th>
                    <th scope="col" className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F5F8]">
                  {data.rows.map(({ school, acceptance, reaccept: re }) => {
                    const isExpanded = expanded === school.id;
                    return (
                      <Fragment key={school.id}>
                        <tr className={`align-top hover:bg-[#FAFBFC] transition-colors ${isExpanded ? 'bg-[#FAFBFC]' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#0E2A5C] leading-tight">{school.name}</p>
                            <p className="text-[11px] text-[#9CA3AF] mt-0.5">{school.schoolId}</p>
                          </td>
                          <td className="px-4 py-3 text-[#6B7280] hidden sm:table-cell">
                            {[school.city, school.state].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {acceptance ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#047857]/[0.08] px-2 py-0.5 text-[11.5px] font-semibold text-[#047857]">
                                <CheckCircle2 size={11} /> Accepted
                              </span>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#B45309]/[0.08] px-2 py-0.5 text-[11.5px] font-semibold text-[#B45309]">
                                  <Clock size={11} /> Pending
                                </span>
                                {re && (
                                  <p
                                    className="mt-1 text-[11px] leading-snug text-[#6B7280]"
                                    title={`Previously accepted on ${fmt(re.previousAcceptedAt)}${re.reason ? ` — Reason: ${re.reason}` : ''}`}
                                  >
                                    Re-acceptance requested<br />{fmt(re.requestedAt)}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#374151] hidden md:table-cell">
                            {acceptance ? <span>{acceptance.signatoryName}<br /><span className="text-[11px] text-[#9CA3AF]">{acceptance.signatoryDesignation}</span></span> : '—'}
                          </td>
                          <td className="px-4 py-3 text-[#6B7280] hidden lg:table-cell">
                            {acceptance ? fmt(acceptance.acceptedAt) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {acceptance && (
                              <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openReaccept(acceptance, school)}
                                title="Ask this school to accept the agreement again"
                                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[#E4E8EE] bg-white text-[12px] font-medium text-[#4B5563] hover:border-[#B45309]/40 hover:text-[#B45309] whitespace-nowrap transition-colors cursor-pointer"
                              >
                                <RotateCcw size={12} /> <span className="hidden xl:inline">Ask to accept again</span>
                              </button>
                              <button
                                onClick={() => setExpanded(isExpanded ? null : school.id)}
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? 'Collapse details' : 'View details'}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EEF1F5] text-[#6B7280] hover:text-[#0E2A5C] transition-colors"
                              >
                                {isExpanded ? <X size={13} /> : <ChevronLeft size={13} className="rotate-180" />}
                              </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {isExpanded && acceptance && (
                          <tr key={`${school.id}-detail`} className="bg-[#F8FAFC]">
                            <td colSpan={6} className="px-4 pb-4 pt-1">
                              <ExpandedDetail acceptance={acceptance} school={school} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </>
      )}

      {/* Pagination */}
      {status === 'ok' && current && current.totalPages > 1 && (
            <div className="flex items-center justify-between text-[13px]">
              <p className="text-[#6B7280]">
                {((page - 1) * current.pageSize) + 1}–{Math.min(page * current.pageSize, current.total)} of {current.total} {roleMeta.noun}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E4E8EE] bg-white hover:bg-[#F3F5F8] disabled:opacity-40 transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <span className="px-3 py-1 rounded-lg border border-[#E4E8EE] bg-white tabular-nums">{page} / {current.totalPages}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page === current.totalPages} className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E4E8EE] bg-white hover:bg-[#F3F5F8] disabled:opacity-40 transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
      )}

      {reaccept && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#04172F]/50 backdrop-blur-[2px] p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="reaccept-title" className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B45309]/[0.08] flex items-center justify-center flex-shrink-0">
                <RotateCcw size={18} className="text-[#B45309]" />
              </div>
              <div className="min-w-0">
                <h2 id="reaccept-title" className="text-[16px] font-semibold text-[#0E2A5C]">Ask {reaccept.school.name} to accept again?</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[#4B5563]">
                  Their acceptance of {fmt(reaccept.acceptance.acceptedAt)} will be marked as revoked and kept on record.
                  The agreement screen will show again the next time the school opens the School Panel, and they must accept it again.
                </p>
              </div>
            </div>
            <label htmlFor="reaccept-reason" className="mt-4 block text-[12px] font-medium text-[#374151]">
              Reason <span className="font-normal text-[#9CA3AF]">(optional, for the record)</span>
            </label>
            <textarea
              id="reaccept-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Accepted by the wrong person"
              className="mt-1 w-full rounded-lg border border-[#E4E8EE] px-3 py-2 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#1559C7] focus:outline-none resize-none"
            />
            {reacceptError && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {reacceptError}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setReaccept(null)}
                disabled={reacceptBusy}
                className="h-9 px-4 rounded-lg border border-[#E4E8EE] bg-white text-[13px] font-medium text-[#374151] hover:bg-[#F3F5F8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmReaccept}
                disabled={reacceptBusy}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#B45309] text-[13px] font-semibold text-white hover:bg-[#92400E] disabled:opacity-60 cursor-pointer"
              >
                {reacceptBusy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Ask to accept again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Expanded detail panel ───────────────────────────────────────────────── */

function ExpandedDetail({ acceptance, school }: { acceptance: Acceptance; school: SchoolRow['school'] }) {
  const sections: { icon: any; label: string; rows: [string, string][] }[] = [
    {
      icon: User,
      label: 'Signatory',
      rows: [
        ['Name', acceptance.signatoryName],
        ['Designation', acceptance.signatoryDesignation],
      ],
    },
    {
      icon: Calendar,
      label: 'Acceptance record',
      rows: [
        ['Reference ID', acceptance.id],
        ['Accepted at', fmt(acceptance.acceptedAt)],
        ['Agreement version', acceptance.documentVersion],
        ['Verification method', acceptance.verificationChannel.replace(/_/g, ' ')],
      ],
    },
    {
      icon: Fingerprint,
      label: 'Technical evidence',
      rows: [
        ['IP address', acceptance.ipAddress || 'Not recorded'],
        ['Email copy sent to', acceptance.emailCopyTo || '—'],
        ['Email sent at', acceptance.emailCopySentAt ? fmt(acceptance.emailCopySentAt) : '—'],
      ],
    },
    {
      icon: Building2,
      label: 'School details (on record)',
      rows: Object.entries(acceptance.details || {}).map(([k, v]) => [
        k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
        v ?? '—',
      ]) as [string, string][],
    },
  ];

  return (
    <div className="mt-2 grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {sections.map(sec => (
        <div key={sec.label} className="rounded-lg border border-[#E4E8EE] bg-white p-3">
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-[#F3F5F8]">
            <sec.icon size={13} className="text-[#1559C7]" />
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280]">{sec.label}</p>
          </div>
          <dl className="space-y-1.5">
            {sec.rows.map(([k, v]) => (
              <div key={k} className="text-[12px]">
                <dt className="text-[#9CA3AF]">{k}</dt>
                <dd className="text-[#111827] font-medium break-all">{v || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
