'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, Send, AlertTriangle } from 'lucide-react';
import { CARD, CARD_HEADER, CARD_TITLE, STACK, INPUT, BTN_PRIMARY, BTN_SECONDARY } from '../../ui';
import { StatusBadge, LoadingState, ErrorState } from '../../components';
import { SupportThread, AttachmentPicker, type ThreadMessage } from '@/components/schoolSupport/SupportThread';
import {
  SUPPORT_LIMITS, SUPPORT_STATUS_LABEL, categoryLabel, ticketRef,
  type SupportAttachment, type SupportStatus,
} from '@/lib/schoolSupport';
import { STATUS_TONE, getSchoolToken, fmtDateTime } from '../shared';

interface TicketDetail {
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
  messages: ThreadMessage[];
}

export default function SchoolSupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [actionErr, setActionErr] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/school/me/support/${id}`, { headers: { Authorization: `Bearer ${getSchoolToken()}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Could not load this request.');
      setTicket(json.ticket);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Could not load this request.');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    setActionErr('');
    try {
      const res = await fetch(`/api/school/me/support/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSchoolToken()}` },
        body: JSON.stringify({ message: reply, attachments }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || 'Could not send your reply.');
      setReply('');
      setAttachments([]);
      await load();
    } catch (e: any) {
      setActionErr(e.message || 'Could not send your reply.');
    } finally {
      setSending(false);
    }
  };

  const markResolved = async () => {
    if (!confirm('Mark this request as resolved? You can reopen it later by replying.')) return;
    setResolving(true);
    setActionErr('');
    try {
      const res = await fetch(`/api/school/me/support/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getSchoolToken()}` },
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || 'Could not update this request.');
      await load();
    } catch (e: any) {
      setActionErr(e.message || 'Could not update this request.');
    } finally {
      setResolving(false);
    }
  };

  if (error) return <div className={STACK}><BackLink /><ErrorState message={error} /></div>;
  if (!ticket) return <div className={STACK}><BackLink /><LoadingState label="Loading request…" /></div>;

  const resolved = ticket.status === 'RESOLVED';

  return (
    <div className={STACK}>
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-[#677285]">{ticketRef(ticket.ticketNo)} · {categoryLabel(ticket.category)}</p>
          <h1 className="mt-0.5 text-[18px] font-semibold leading-tight tracking-[-0.015em] text-[#0B1B33]">{ticket.subject}</h1>
          <p className="mt-1 text-[12px] text-[#677285]">Raised {fmtDateTime(ticket.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ticket.priority === 'URGENT' && <StatusBadge tone="danger" icon={AlertTriangle}>Urgent</StatusBadge>}
          <StatusBadge tone={STATUS_TONE[ticket.status]}>{SUPPORT_STATUS_LABEL[ticket.status]}</StatusBadge>
          {!resolved && (
            <button className={BTN_SECONDARY} onClick={markResolved} disabled={resolving}>
              {resolving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} My issue is solved
            </button>
          )}
        </div>
      </div>

      {ticket.status === 'AWAITING_SCHOOL' && (
        <div className="rounded-lg border border-[#F2D3D3] bg-[#FEF7F7] px-3.5 py-2.5 text-[12.5px] text-[#8C2A20]">
          Our team is waiting for your reply. Please answer below so we can continue.
        </div>
      )}

      <div className={CARD}>
        <div className={CARD_HEADER}><p className={CARD_TITLE}>Conversation</p></div>
        <div className="px-3.5 py-3.5">
          <SupportThread messages={ticket.messages} viewer="SCHOOL" />
        </div>
      </div>

      <div className={CARD}>
        <div className={CARD_HEADER}>
          <p className={CARD_TITLE}>{resolved ? 'Still facing the problem? Reply to reopen' : 'Reply'}</p>
        </div>
        <div className="space-y-2.5 px-3.5 py-3.5">
          <textarea
            className={`${INPUT} min-h-[96px] resize-y`}
            value={reply}
            maxLength={SUPPORT_LIMITS.body}
            onChange={e => setReply(e.target.value)}
            placeholder={resolved ? 'Describe what is still not working — this will reopen the request.' : 'Write your reply…'}
          />
          <AttachmentPicker value={attachments} onChange={setAttachments} uploadUrl="/api/school/me/support/upload" token={getSchoolToken()} />
          {actionErr && <ErrorState message={actionErr} />}
          <div className="flex justify-end">
            <button className={BTN_PRIMARY} onClick={send} disabled={!reply.trim() || sending}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {resolved ? 'Reopen & send' : 'Send reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/school/support" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#475265] hover:text-[#1559C7]">
      <ArrowLeft size={14} /> All requests
    </Link>
  );
}
