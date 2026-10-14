'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LifeBuoy, Plus, Clock, CheckCircle2, MessageCircle, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { STACK, INPUT, LABEL, BTN_PRIMARY, BTN_SECONDARY, TABLE, TH, TD, TR } from '../ui';
import { PageHeader, StatTile, StatusBadge, FilterPill, LoadingState, ErrorState, EmptyState, ModalShell, TableShell, RowCount } from '../components';
import { AttachmentPicker } from '@/components/schoolSupport/SupportThread';
import {
  SUPPORT_CATEGORIES, SUPPORT_LIMITS, SUPPORT_STATUS_LABEL, categoryLabel, ticketRef,
  type SupportAttachment, type SupportStatus,
} from '@/lib/schoolSupport';
import { STATUS_TONE, getSchoolToken as getToken, fmtDateTime as fmtDate } from './shared';

interface TicketRow {
  id: string;
  ticketNo: number;
  category: string;
  subject: string;
  priority: 'NORMAL' | 'URGENT';
  status: SupportStatus;
  unreadBySchool: boolean;
  lastMessageAt: string;
  createdAt: string;
  messageCount: number;
}

type Filter = 'ALL' | 'ACTIVE' | 'AWAITING_SCHOOL' | 'RESOLVED';

export default function SchoolSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [counts, setCounts] = useState<Record<SupportStatus, number>>({ OPEN: 0, IN_PROGRESS: 0, AWAITING_SCHOOL: 0, RESOLVED: 0 });
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/school/me/support', { headers: { Authorization: `Bearer ${getToken()}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Could not load your requests.');
      setTickets(json.tickets);
      setCounts(json.counts);
    } catch (e: any) {
      setError(e.message || 'Could not load your requests.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const all = tickets ?? [];
    if (filter === 'ACTIVE') return all.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
    if (filter === 'ALL') return all;
    return all.filter(t => t.status === filter);
  }, [tickets, filter]);

  const loading = tickets === null && !error;

  return (
    <div className={STACK}>
      <PageHeader
        title="Help & Support"
        subtitle="Facing a problem with the School Panel, Olympiad IDs, papers or results? Raise a request and our team will reply here."
        actions={
          <button className={BTN_PRIMARY} onClick={() => setShowNew(true)}>
            <Plus size={15} /> New request
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="All requests" value={tickets?.length ?? 0} icon={LifeBuoy} loading={loading} active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
        <StatTile label="With support team" value={counts.OPEN + counts.IN_PROGRESS} icon={Clock} loading={loading} active={filter === 'ACTIVE'} onClick={() => setFilter('ACTIVE')} hint="Open or in progress" />
        <StatTile label="Awaiting your reply" value={counts.AWAITING_SCHOOL} icon={MessageCircle} loading={loading} active={filter === 'AWAITING_SCHOOL'} onClick={() => setFilter('AWAITING_SCHOOL')} />
        <StatTile label="Resolved" value={counts.RESOLVED} icon={CheckCircle2} loading={loading} active={filter === 'RESOLVED'} onClick={() => setFilter('RESOLVED')} />
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <LoadingState label="Loading your requests…" />
      ) : !tickets!.length ? (
        <EmptyState icon={LifeBuoy} title="No support requests yet" hint="When you raise a request, you can follow the conversation with our team here." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <FilterPill active={filter === 'ALL'} onClick={() => setFilter('ALL')}>All</FilterPill>
            <FilterPill active={filter === 'ACTIVE'} onClick={() => setFilter('ACTIVE')}>With support team</FilterPill>
            <FilterPill active={filter === 'AWAITING_SCHOOL'} onClick={() => setFilter('AWAITING_SCHOOL')}>Awaiting your reply</FilterPill>
            <FilterPill active={filter === 'RESOLVED'} onClick={() => setFilter('RESOLVED')}>Resolved</FilterPill>
          </div>
          {!shown.length ? (
            <EmptyState title="No requests in this view" />
          ) : (
            <TableShell footer={<RowCount shown={shown.length} total={tickets!.length} noun="requests" />}>
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>Reference</th>
                    <th className={TH}>Subject</th>
                    <th className={TH}>Category</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Last update</th>
                    <th className={TH} aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map(t => (
                    <tr key={t.id} className={`${TR} cursor-pointer`} onClick={() => router.push(`/school/support/${t.id}`)}>
                      <td className={`${TD} font-mono text-[12.5px]`}>
                        <Link href={`/school/support/${t.id}`} className="text-[#1559C7] hover:underline" onClick={e => e.stopPropagation()}>
                          {ticketRef(t.ticketNo)}
                        </Link>
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          {t.unreadBySchool && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#1559C7]" aria-label="New reply" />}
                          <span className={`max-w-[360px] truncate ${t.unreadBySchool ? 'font-semibold text-[#0F1B2D]' : ''}`}>{t.subject}</span>
                          {t.priority === 'URGENT' && <StatusBadge tone="danger" icon={AlertTriangle}>Urgent</StatusBadge>}
                        </div>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{categoryLabel(t.category)}</td>
                      <td className={TD}>
                        <StatusBadge tone={STATUS_TONE[t.status]}>{SUPPORT_STATUS_LABEL[t.status]}</StatusBadge>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-[12.5px] text-[#677285]`}>{fmtDate(t.lastMessageAt)}</td>
                      <td className={`${TD} text-right`}><ChevronRight size={15} className="inline text-[#98A1B2]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </>
      )}

      {showNew && (
        <NewRequestModal
          onClose={() => setShowNew(false)}
          onCreated={id => { setShowNew(false); router.push(`/school/support/${id}`); }}
        />
      )}
    </div>
  );
}

function NewRequestModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const canSubmit = !!category && !!subject.trim() && !!message.trim() && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/school/me/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ category, subject, message, priority, contactName, contactPhone, attachments }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || 'Could not submit your request.');
      onCreated(json.id);
    } catch (e: any) {
      setErr(e.message || 'Could not submit your request.');
      setBusy(false);
    }
  };

  return (
    <ModalShell eyebrow="Help & Support" title="Raise a new request" onClose={onClose} maxWidth="max-w-xl">
      <div className="max-h-[70vh] space-y-3.5 overflow-y-auto px-5 py-4">
        <div>
          <label className={LABEL} htmlFor="sup-cat">What is this about? *</label>
          <select id="sup-cat" className={INPUT} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Select a category</option>
            {SUPPORT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="sup-subj">Subject *</label>
          <input id="sup-subj" className={INPUT} value={subject} maxLength={SUPPORT_LIMITS.subject}
            onChange={e => setSubject(e.target.value)} placeholder="e.g. Unable to download Olympiad ID list" />
        </div>
        <div>
          <label className={LABEL} htmlFor="sup-msg">Describe the problem *</label>
          <textarea id="sup-msg" className={`${INPUT} min-h-[120px] resize-y`} value={message} maxLength={SUPPORT_LIMITS.body}
            onChange={e => setMessage(e.target.value)}
            placeholder="What were you trying to do, what happened, and any Olympiad IDs / student names involved." />
          <p className="mt-1 text-right text-[11px] text-[#8A93A3]">{message.length}/{SUPPORT_LIMITS.body}</p>
        </div>
        <AttachmentPicker value={attachments} onChange={setAttachments} uploadUrl="/api/school/me/support/upload" token={getToken()} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="sup-cn">Contact person</label>
            <input id="sup-cn" className={INPUT} value={contactName} maxLength={100} onChange={e => setContactName(e.target.value)} placeholder="Who should we talk to?" />
          </div>
          <div>
            <label className={LABEL} htmlFor="sup-cp">Contact phone</label>
            <input id="sup-cp" className={INPUT} value={contactPhone} maxLength={20} inputMode="tel" onChange={e => setContactPhone(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-[#2A3446]">
          <input type="checkbox" className="mt-0.5" checked={priority === 'URGENT'} onChange={e => setPriority(e.target.checked ? 'URGENT' : 'NORMAL')} />
          <span><b>Urgent</b> — it is blocking an exam, paper dispatch or result today.</span>
        </label>
        {err && <ErrorState message={err} />}
      </div>
      <div className="flex justify-end gap-2 border-t border-[#EEF0F3] px-5 py-3">
        <button className={BTN_SECONDARY} onClick={onClose} disabled={busy}>Cancel</button>
        <button className={BTN_PRIMARY} onClick={submit} disabled={!canSubmit}>
          {busy && <Loader2 size={14} className="animate-spin" />} Submit request
        </button>
      </div>
    </ModalShell>
  );
}
