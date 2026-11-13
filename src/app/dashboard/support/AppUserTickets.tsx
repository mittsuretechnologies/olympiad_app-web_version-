'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CheckCircle2, Mail, Phone, RotateCcw, X } from 'lucide-react';
import { authFetch, fetcher } from '@/lib/swr';
import {
  Button, Composer, DetailHeader, EmptyState, ListRow, LoadingState, Pill, RequesterCard, SearchInput, Segmented,
  Select, SplitPane, Toolbar, UnreadDot, fullTime, refreshSupportCounts, shortTime,
} from './ui';

// "App users" tab of /dashboard/support — Help & Support queries sent from the
// mobile app. Each ticket holds one message and one team reply (a new reply
// replaces the old one), so the detail shows those two rather than a thread.

interface Ticket {
  id: string;
  type: 'TECHNICAL' | 'REMARK';
  category: string | null;
  message: string;
  screenshotUrls: string[];
  status: 'OPEN' | 'RESOLVED';
  resolvedAt: string | null;
  adminResponse: string | null;
  respondedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    userId: string;
    email: string | null;
    mobile: string | null;
    avatarUrl: string | null;
    olympiadId: string | null;
  };
}

interface ApiResponse {
  counts: { OPEN: number; RESOLVED: number };
  tickets: Ticket[];
}

type Filter = 'OPEN' | 'RESOLVED' | 'ALL';
type TypeFilter = '' | 'TECHNICAL' | 'REMARK';

const typeLabel = (t: Ticket['type']) => (t === 'REMARK' ? 'Remark' : 'Technical');
const ticketTitle = (t: Ticket) => t.category || (t.type === 'REMARK' ? 'Remark / feedback' : 'Technical issue');
const needsReply = (t: Ticket) => t.status === 'OPEN' && !t.adminResponse;

function StatusPill({ status }: { status: Ticket['status'] }) {
  return status === 'OPEN' ? <Pill tone="blue" dot>Open</Pill> : <Pill tone="green" dot>Resolved</Pill>;
}

export function AppUserTickets() {
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [type, setType] = useState<TypeFilter>('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load every ticket once and filter here, so the open ticket stays on
  // screen after it is resolved and drops out of the "Open" list.
  const { data, isLoading, mutate } = useSWR<ApiResponse>('/api/dashboard/support-tickets', fetcher);
  const counts = data?.counts ?? { OPEN: 0, RESOLVED: 0 };
  const all = data?.tickets;

  const tickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (all ?? []).filter(t =>
      (filter === 'ALL' || t.status === filter) &&
      (!type || t.type === type) &&
      (!q ||
        t.message.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.user.userId?.toLowerCase().includes(q) ||
        t.user.email?.toLowerCase().includes(q) ||
        t.user.mobile?.toLowerCase().includes(q) ||
        t.user.olympiadId?.toLowerCase().includes(q)),
    );
  }, [all, filter, type, search]);

  const awaiting = useMemo(() => (all ?? []).filter(needsReply).length, [all]);
  const selected = selectedId ? all?.find(t => t.id === selectedId) ?? null : null;

  const onChanged = async () => { await mutate(); refreshSupportCounts(); };

  return (
    <div className="space-y-3">
      <Toolbar>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'OPEN', label: 'Open', count: counts.OPEN },
            { value: 'RESOLVED', label: 'Resolved', count: counts.RESOLVED },
            { value: 'ALL', label: 'All', count: counts.OPEN + counts.RESOLVED },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={type} onChange={v => setType(v as TypeFilter)} className="sm:w-40">
            <option value="">All types</option>
            <option value="TECHNICAL">Technical</option>
            <option value="REMARK">Remark</option>
          </Select>
          <SearchInput value={search} onChange={setSearch} placeholder="Search message, user ID, email or mobile" />
        </div>
      </Toolbar>

      <SplitPane
        onBack={() => setSelectedId(null)}
        emptyDetail="Pick a ticket from the list to read it and reply."
        listHeader={
          <span>
            {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
            {awaiting > 0 && <span className="text-[#004f9f]"> · {awaiting} awaiting a reply</span>}
          </span>
        }
        list={
          isLoading ? <LoadingState />
          : !tickets.length ? <EmptyState title="No tickets" body={search || type ? 'Nothing matches these filters.' : 'Queries sent from the app’s Help & Support screen appear here.'} />
          : (
            <ul className="divide-y divide-gray-100">
              {tickets.map(t => {
                const unread = needsReply(t);
                return (
                  <ListRow key={t.id} selected={selectedId === t.id} onClick={() => setSelectedId(t.id)}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11px] text-gray-400">{typeLabel(t.type)}{t.category ? ` · ${t.category}` : ''}</span>
                      <span className={`shrink-0 text-[11px] tabular-nums ${unread ? 'font-medium text-[#004f9f]' : 'text-gray-400'}`}>{shortTime(t.createdAt)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      {unread && <UnreadDot label="Awaiting a reply" />}
                      <p className={`truncate text-[13px] ${unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>{t.message}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {t.user.userId}{t.user.olympiadId ? ` · ${t.user.olympiadId}` : ''}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <StatusPill status={t.status} />
                      {t.adminResponse && <Pill tone="gray">Replied</Pill>}
                    </div>
                  </ListRow>
                );
              })}
            </ul>
          )
        }
        detail={selected ? <TicketPanel key={selected.id} ticket={selected} onChanged={onChanged} /> : null}
      />
    </div>
  );
}

// ─── Detail panel ───────────────────────────────────────────────────────────

function TicketPanel({ ticket: t, onChanged }: { ticket: Ticket; onChanged: () => Promise<void> }) {
  const [reply, setReply] = useState('');
  const [resolveAfter, setResolveAfter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);

  const patch = async (body: { status?: 'OPEN' | 'RESOLVED'; response?: string }, fallback: string) => {
    setBusy(true); setErr('');
    try {
      const res = await authFetch(`/api/dashboard/support-tickets/${t.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || fallback);
      await onChanged();
      return true;
    } catch (e: any) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    const response = reply.trim();
    if (!response || busy) return;
    const ok = await patch({ response, ...(resolveAfter ? { status: 'RESOLVED' as const } : {}) }, 'Failed to send reply');
    if (ok) { setReply(''); setResolveAfter(false); }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-5">
          <DetailHeader
            eyebrow={<><span>{typeLabel(t.type)}</span><span aria-hidden>·</span><StatusPill status={t.status} /></>}
            title={ticketTitle(t)}
            meta={<>Sent {fullTime(t.createdAt)}{t.status === 'RESOLVED' && t.resolvedAt ? ` · Resolved ${fullTime(t.resolvedAt)}` : ''}</>}
            actions={t.status === 'OPEN' ? (
              <Button disabled={busy} onClick={() => patch({ status: 'RESOLVED' }, 'Failed to update')}>
                <CheckCircle2 size={13} className="text-emerald-600" /> Mark resolved
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => patch({ status: 'OPEN' }, 'Failed to update')}>
                <RotateCcw size={13} /> Reopen
              </Button>
            )}
          />
          <RequesterCard
            avatar={t.user.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={t.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              : (t.user.userId?.[0]?.toUpperCase() ?? '?')}
            name={t.user.userId}
            sub={t.user.olympiadId ? `Olympiad ID ${t.user.olympiadId}` : 'App user'}
            contacts={[
              ...(t.user.mobile ? [{ icon: <Phone size={12} />, label: t.user.mobile, href: `tel:${t.user.mobile}` }] : []),
              ...(t.user.email ? [{ icon: <Mail size={12} />, label: t.user.email, href: `mailto:${t.user.email}` }] : []),
            ]}
          />
        </div>

        {/* Same look as the school thread: theirs on the left, ours on the right. */}
        <ol className="space-y-3 bg-gray-50/70 px-4 py-5 sm:px-5">
          <li className="flex justify-start">
            <div className="max-w-[85%] rounded-xl border border-[#E6E8EC] bg-white px-3.5 py-2.5">
              <p className="mb-1 text-[11.5px] font-semibold text-[#475265]">
                {t.user.userId} <span className="font-normal text-[#8A93A3]">· {fullTime(t.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#0F1B2D]">{t.message}</p>
              {t.screenshotUrls.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {t.screenshotUrls.map((url, i) => (
                    <button key={url} type="button" onClick={() => setLightbox(url)} aria-label={`Open screenshot ${i + 1}`}
                      className="h-20 w-20 overflow-hidden rounded-lg border border-gray-200 hover:border-gray-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </li>
          {t.adminResponse && (
            <li className="flex justify-end">
              <div className="max-w-[85%] rounded-xl border border-[#C9D8F3] bg-[#EEF3FC] px-3.5 py-2.5">
                <p className="mb-1 text-[11.5px] font-semibold text-[#475265]">
                  You{t.respondedAt && <span className="font-normal text-[#8A93A3]"> · {fullTime(t.respondedAt)}</span>}
                </p>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#0F1B2D]">{t.adminResponse}</p>
              </div>
            </li>
          )}
        </ol>
      </div>

      <Composer
        value={reply}
        onChange={setReply}
        onSend={sendReply}
        busy={busy}
        error={err}
        placeholder={`Reply to ${t.user.userId}…`}
        sendLabel={t.adminResponse ? 'Replace reply' : 'Send reply'}
        options={t.status === 'OPEN' && (
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={resolveAfter} onChange={e => setResolveAfter(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 accent-[#004f9f]" />
            Mark resolved after sending
          </label>
        )}
        hint={t.adminResponse
          ? 'The app shows one reply per ticket, so sending replaces your reply above. Press Ctrl + Enter to send.'
          : 'The user sees your reply in the app. Press Ctrl + Enter to send.'}
      />

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setLightbox(null)} aria-label="Close" className="absolute right-4 top-4 text-white/70 hover:text-white">
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Screenshot" className="max-h-full max-w-full rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
