'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  LifeBuoy, RefreshCw, Search, Send, School, Mail, Phone, User, MapPin, AlertTriangle, Loader2, Inbox,
} from 'lucide-react';
import { fetcher, getDashboardToken } from '@/lib/swr';
import { SupportThread, type ThreadMessage } from '@/components/schoolSupport/SupportThread';
import {
  SUPPORT_CATEGORIES, SUPPORT_LIMITS, SUPPORT_STATUSES, SUPPORT_STATUS_LABEL_TEAM, categoryLabel, ticketRef,
  type SupportStatus,
} from '@/lib/schoolSupport';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Row {
  id: string;
  ticketNo: number;
  category: string;
  subject: string;
  priority: 'NORMAL' | 'URGENT';
  status: SupportStatus;
  unreadByTeam: boolean;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
  school: { id: string; name: string; schoolId: string; city: string | null; state: string | null };
}

interface ListResponse {
  counts: Record<SupportStatus, number>;
  unread: number;
  tickets: Row[];
}

interface Detail {
  id: string;
  ticketNo: number;
  category: string;
  subject: string;
  priority: 'NORMAL' | 'URGENT';
  status: SupportStatus;
  contactName: string | null;
  contactPhone: string | null;
  createdAt: string;
  resolvedAt: string | null;
  school: {
    id: string; name: string; schoolId: string; email: string | null; phone: string | null; contactPerson: string | null;
    city: string | null; district: string | null; state: string | null;
  };
  messages: ThreadMessage[];
}

type Filter = SupportStatus | 'ALL';

const STATUS_STYLE: Record<SupportStatus, string> = {
  OPEN:            'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS:     'bg-amber-50 text-amber-700 border-amber-200',
  AWAITING_SCHOOL: 'bg-purple-50 text-purple-700 border-purple-200',
  RESOLVED:        'bg-green-50 text-green-700 border-green-200',
};

const fmt = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

function authHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getDashboardToken() || ''}` };
}

function StatusPill({ status }: { status: SupportStatus }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>
      {SUPPORT_STATUS_LABEL_TEAM[status]}
    </span>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

// useSearchParams (for the ?ticket= deep link) needs a Suspense boundary for
// the production build.
export default function SchoolSupportInboxPage() {
  return (
    <Suspense fallback={null}>
      <SchoolSupportInbox />
    </Suspense>
  );
}

function SchoolSupportInbox() {
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Deep link from the team's notification email (?ticket=<id>) opens that
  // request whatever its status.
  useEffect(() => {
    const t = searchParams.get('ticket');
    if (t) { setSelectedId(t); setFilter('ALL'); }
  }, [searchParams]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const h = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  const qs = new URLSearchParams();
  if (filter !== 'ALL') qs.set('status', filter);
  if (category) qs.set('category', category);
  if (query) qs.set('q', query);
  const { data, isLoading, mutate } = useSWR<ListResponse>(`/api/dashboard/school-support?${qs}`, fetcher, { refreshInterval: 30_000 });

  const counts = useMemo(() => data?.counts ?? { OPEN: 0, IN_PROGRESS: 0, AWAITING_SCHOOL: 0, RESOLVED: 0 }, [data]);
  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">School Support</h1>
        </div>
        <button onClick={() => mutate()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {SUPPORT_STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${filter === s ? 'border-[#004f9f] bg-[#004f9f] text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
            {SUPPORT_STATUS_LABEL_TEAM[s]} <span className="ml-1 opacity-75">{counts[s]}</span>
          </button>
        ))}
        <button onClick={() => setFilter('ALL')}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${filter === 'ALL' ? 'border-[#004f9f] bg-[#004f9f] text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
          All <span className="ml-1 opacity-75">{total}</span>
        </button>
        {!!data?.unread && (
          <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">
            {data.unread} with new school activity
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by HS-number, subject, school name or code…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-[#004f9f] focus:outline-none" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#004f9f] focus:outline-none">
          <option value="">All categories</option>
          {SUPPORT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" /> Loading…</div>
          ) : !data?.tickets.length ? (
            <div className="flex flex-col items-center gap-2 py-16 text-sm text-gray-400"><Inbox size={22} /> No requests here</div>
          ) : (
            <ul className="max-h-[calc(100vh-260px)] divide-y divide-gray-100 overflow-y-auto">
              {data.tickets.map(t => (
                <li key={t.id}>
                  <button onClick={() => setSelectedId(t.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${selectedId === t.id ? 'bg-blue-50/70' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-gray-500">{ticketRef(t.ticketNo)} · {t.school.schoolId}</span>
                      <span className="text-[11px] text-gray-400">{fmt(t.lastMessageAt)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {t.unreadByTeam && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" aria-label="New activity" />}
                      <p className={`truncate text-sm ${t.unreadByTeam ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>{t.subject}</p>
                    </div>
                    <p className="truncate text-xs text-gray-500">{t.school.name}{t.school.city ? `, ${t.school.city}` : ''}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusPill status={t.status} />
                      {t.priority === 'URGENT' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                          <AlertTriangle size={10} /> Urgent
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">{categoryLabel(t.category)} · {t.messageCount} msg</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          {selectedId
            ? <TicketPanel key={selectedId} id={selectedId} onChanged={() => mutate()} />
            : <div className="flex flex-col items-center gap-2 py-24 text-sm text-gray-400"><LifeBuoy size={22} /> Select a request to read and reply</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Detail panel ───────────────────────────────────────────────────────────

function TicketPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { data, error, isLoading, mutate } = useSWR<{ ticket: Detail }>(`/api/dashboard/school-support/${id}`, fetcher);
  const [reply, setReply] = useState('');
  const [replyStatus, setReplyStatus] = useState<SupportStatus>('AWAITING_SCHOOL');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Opening a request clears its unread flag server-side; refresh the list dot.
  useEffect(() => { if (data) onChanged(); }, [data?.ticket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (error || !data) return <div className="py-24 text-center text-sm text-red-500">Could not load this request.</div>;

  const t = data.ticket;

  const sendReply = async () => {
    if (!reply.trim() || busy) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/dashboard/school-support/${id}/messages`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ message: reply, status: replyStatus }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || 'Failed to send reply');
      setReply('');
      await mutate();
      onChanged();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const patch = async (body: { status?: SupportStatus; priority?: 'NORMAL' | 'URGENT' }) => {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/dashboard/school-support/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || 'Failed to update');
      await mutate();
      onChanged();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const place = [t.school.city, t.school.district, t.school.state].filter(Boolean).join(', ');

  return (
    <div className="flex h-full flex-col">
      {/* Head */}
      <div className="space-y-2 border-b border-gray-100 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-xs text-gray-500">{ticketRef(t.ticketNo)} · {categoryLabel(t.category)} · raised {fmt(t.createdAt)}</p>
            <h2 className="text-base font-bold text-gray-900">{t.subject}</h2>
          </div>
          <div className="flex items-center gap-2">
            <select value={t.status} disabled={busy} onChange={e => patch({ status: e.target.value as SupportStatus })}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold focus:outline-none">
              {SUPPORT_STATUSES.map(s => <option key={s} value={s}>{SUPPORT_STATUS_LABEL_TEAM[s]}</option>)}
            </select>
            <button disabled={busy} onClick={() => patch({ priority: t.priority === 'URGENT' ? 'NORMAL' : 'URGENT' })}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${t.priority === 'URGENT' ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              <AlertTriangle size={11} /> {t.priority === 'URGENT' ? 'Urgent' : 'Mark urgent'}
            </button>
          </div>
        </div>
        {/* School contact */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-xl bg-gray-50 p-3 text-xs text-gray-600 sm:grid-cols-2">
          <span className="flex items-center gap-1.5"><School size={12} className="text-gray-400" /> <b className="text-gray-800">{t.school.name}</b> ({t.school.schoolId})</span>
          {place && <span className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-400" /> {place}</span>}
          {(t.contactName || t.school.contactPerson) && <span className="flex items-center gap-1.5"><User size={12} className="text-gray-400" /> {t.contactName || t.school.contactPerson}</span>}
          {(t.contactPhone || t.school.phone) && (
            <a href={`tel:${t.contactPhone || t.school.phone}`} className="flex items-center gap-1.5 hover:text-[#004f9f]"><Phone size={12} className="text-gray-400" /> {t.contactPhone || t.school.phone}</a>
          )}
          {t.school.email && (
            <a href={`mailto:${t.school.email}`} className="flex items-center gap-1.5 truncate hover:text-[#004f9f]"><Mail size={12} className="text-gray-400" /> {t.school.email}</a>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="max-h-[calc(100vh-520px)] min-h-[200px] flex-1 overflow-y-auto p-4">
        <SupportThread messages={t.messages} viewer="TEAM" />
      </div>

      {/* Reply */}
      <div className="space-y-2 border-t border-gray-100 p-4">
        <textarea value={reply} onChange={e => setReply(e.target.value)} maxLength={SUPPORT_LIMITS.body}
          placeholder="Write a reply to the school… (they see it as “Mittmee Support”)"
          className="min-h-[90px] w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[#004f9f] focus:outline-none" />
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="text-xs text-gray-500">After reply, set status</label>
          <select value={replyStatus} onChange={e => setReplyStatus(e.target.value as SupportStatus)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold focus:outline-none">
            {SUPPORT_STATUSES.map(s => <option key={s} value={s}>{SUPPORT_STATUS_LABEL_TEAM[s]}</option>)}
          </select>
          <button onClick={sendReply} disabled={!reply.trim() || busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#004f9f] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#003d7a] disabled:opacity-40">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send reply
          </button>
        </div>
      </div>
    </div>
  );
}
