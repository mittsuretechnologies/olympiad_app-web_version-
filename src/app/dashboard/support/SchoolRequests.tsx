'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Flag, Mail, MessageSquare, Phone } from 'lucide-react';
import { authFetch, fetcher } from '@/lib/swr';
import { SupportThread, type ThreadMessage } from '@/components/schoolSupport/SupportThread';
import {
  SUPPORT_CATEGORIES, SUPPORT_LIMITS, SUPPORT_STATUSES, SUPPORT_STATUS_LABEL_TEAM, categoryLabel, ticketRef,
  type SupportStatus,
} from '@/lib/schoolSupport';
import {
  Button, Composer, DetailHeader, EmptyState, ListRow, LoadingState, Pill, RequesterCard, SearchInput, Segmented,
  Select, SplitPane, Toolbar, UnreadDot, fullTime, refreshSupportCounts, shortTime, type Tone,
} from './ui';

// "Schools" tab of /dashboard/support — requests raised from the School Panel.
// Threaded: each request is a conversation between the school and the team.

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
    id: string; name: string; schoolId: string; olympiadId: string | null; email: string | null; phone: string | null; contactPerson: string | null;
    city: string | null; district: string | null; state: string | null;
  };
  messages: ThreadMessage[];
}

type Filter = SupportStatus | 'ALL';

const STATUS_TONE: Record<SupportStatus, Tone> = {
  OPEN: 'blue',
  IN_PROGRESS: 'amber',
  AWAITING_SCHOOL: 'violet',
  RESOLVED: 'green',
};

function StatusPill({ status }: { status: SupportStatus }) {
  return <Pill tone={STATUS_TONE[status]} dot>{SUPPORT_STATUS_LABEL_TEAM[status]}</Pill>;
}

export function SchoolRequests() {
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
  const tickets = data?.tickets ?? [];

  const onChanged = () => { mutate(); refreshSupportCounts(); };

  return (
    <div className="space-y-3">
      <Toolbar>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            ...SUPPORT_STATUSES.map(s => ({ value: s as Filter, label: SUPPORT_STATUS_LABEL_TEAM[s], count: counts[s] })),
            { value: 'ALL', label: 'All', count: total },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={category} onChange={setCategory} className="sm:w-48">
            <option value="">All categories</option>
            {SUPPORT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <SearchInput value={search} onChange={setSearch} placeholder="Search HS-number, subject or school" />
        </div>
      </Toolbar>

      <SplitPane
        onBack={() => setSelectedId(null)}
        emptyDetail="Pick a request from the list to read the conversation and reply."
        listHeader={
          <span>
            {tickets.length} {tickets.length === 1 ? 'request' : 'requests'}
            {!!data?.unread && <span className="text-[#004f9f]"> · {data.unread} with new replies</span>}
          </span>
        }
        list={
          isLoading ? <LoadingState />
          : !tickets.length ? <EmptyState title="No requests" body={query || category ? 'Nothing matches these filters.' : 'Requests schools raise from the School Panel appear here.'} />
          : (
            <ul className="divide-y divide-gray-100">
              {tickets.map(t => (
                <ListRow key={t.id} selected={selectedId === t.id} onClick={() => setSelectedId(t.id)}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] text-gray-400">{ticketRef(t.ticketNo)}</span>
                    <span className={`shrink-0 text-[11px] tabular-nums ${t.unreadByTeam ? 'font-medium text-[#004f9f]' : 'text-gray-400'}`}>{shortTime(t.lastMessageAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {t.unreadByTeam && <UnreadDot label="New reply from the school" />}
                    <p className={`truncate text-[13px] ${t.unreadByTeam ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>{t.subject}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {t.school.name}{t.school.city ? `, ${t.school.city}` : ''}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <StatusPill status={t.status} />
                    {t.priority === 'URGENT' && <Pill tone="red">Urgent</Pill>}
                    <span className="min-w-0 truncate text-[11px] text-gray-400">{categoryLabel(t.category)}</span>
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-gray-400">
                      <MessageSquare size={11} /> {t.messageCount}
                    </span>
                  </div>
                </ListRow>
              ))}
            </ul>
          )
        }
        detail={selectedId ? <TicketPanel key={selectedId} id={selectedId} onChanged={onChanged} /> : null}
      />
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
  const scroller = useRef<HTMLDivElement>(null);

  // Opening a request clears its unread flag server-side; refresh the list dot.
  useEffect(() => { if (data) onChanged(); }, [data?.ticket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Land on the latest message, and follow new ones.
  const messageCount = data?.ticket.messages.length ?? 0;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messageCount]);

  if (isLoading) return <LoadingState />;
  if (error || !data) return <EmptyState title="Couldn't load this request" body="It may have been removed. Try refreshing." />;

  const t = data.ticket;

  const send = async (path: string, method: 'POST' | 'PATCH', body: object, fallback: string) => {
    setBusy(true); setErr('');
    try {
      const res = await authFetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || fallback);
      await mutate();
      onChanged();
      return true;
    } catch (e: any) {
      setErr(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || busy) return;
    const ok = await send(`/api/dashboard/school-support/${id}/messages`, 'POST', { message: reply, status: replyStatus }, 'Failed to send reply');
    if (ok) setReply('');
  };

  const patch = (body: { status?: SupportStatus; priority?: 'NORMAL' | 'URGENT' }) =>
    send(`/api/dashboard/school-support/${id}`, 'PATCH', body, 'Failed to update');

  const place = [t.school.city, t.school.district, t.school.state].filter(Boolean).join(', ');
  const contactName = t.contactName || t.school.contactPerson;
  const phone = t.contactPhone || t.school.phone;
  const urgent = t.priority === 'URGENT';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-5">
          <DetailHeader
            eyebrow={<>
              <span className="font-mono">{ticketRef(t.ticketNo)}</span>
              <span aria-hidden>·</span>
              <span>{categoryLabel(t.category)}</span>
            </>}
            title={t.subject}
            meta={<>Opened {fullTime(t.createdAt)}{t.resolvedAt && t.status === 'RESOLVED' ? ` · Resolved ${fullTime(t.resolvedAt)}` : ''}</>}
            actions={<>
              <Button variant={urgent ? 'danger-soft' : 'secondary'} disabled={busy}
                onClick={() => patch({ priority: urgent ? 'NORMAL' : 'URGENT' })}
                title={urgent ? 'Remove the urgent flag' : 'Flag as urgent'}>
                <Flag size={13} className={urgent ? 'fill-current' : ''} /> {urgent ? 'Urgent' : 'Mark urgent'}
              </Button>
              <Select value={t.status} onChange={v => patch({ status: v as SupportStatus })}>
                {SUPPORT_STATUSES.map(s => <option key={s} value={s}>{SUPPORT_STATUS_LABEL_TEAM[s]}</option>)}
              </Select>
            </>}
          />
          <RequesterCard
            avatar={t.school.name.trim()[0]?.toUpperCase() ?? '?'}
            name={t.school.name}
            // The CRM ID (stored in School.olympiadId) is what the team knows a school by.
            sub={[t.school.olympiadId && `CRM ${t.school.olympiadId}`, place, !phone && contactName].filter(Boolean).join(' · ')}
            contacts={[
              ...(phone ? [{ icon: <Phone size={12} />, label: contactName ? `${contactName} · ${phone}` : phone, href: `tel:${phone}` }] : []),
              ...(t.school.email ? [{ icon: <Mail size={12} />, label: t.school.email, href: `mailto:${t.school.email}` }] : []),
            ]}
          />
        </div>

        <div className="bg-gray-50/70 px-4 py-5 sm:px-5">
          <SupportThread messages={t.messages} viewer="TEAM" />
        </div>
      </div>

      <Composer
        value={reply}
        onChange={setReply}
        onSend={sendReply}
        busy={busy}
        error={err}
        maxLength={SUPPORT_LIMITS.body}
        placeholder={`Reply to ${t.school.name}…`}
        options={<>
          <span>Then mark as</span>
          <Select value={replyStatus} onChange={v => setReplyStatus(v as SupportStatus)} className="h-7 text-xs">
            {SUPPORT_STATUSES.map(s => <option key={s} value={s}>{SUPPORT_STATUS_LABEL_TEAM[s]}</option>)}
          </Select>
        </>}
        hint={<>The school sees replies from &ldquo;Mittmee Support&rdquo;. Press Ctrl + Enter to send.</>}
      />
    </div>
  );
}
