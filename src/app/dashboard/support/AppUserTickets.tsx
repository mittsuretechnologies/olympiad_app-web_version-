'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { LifeBuoy, RefreshCw, X, CheckCircle, Clock, Mail, Phone, Search, Image as ImageIcon, Send, MessageSquare } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

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

type StatusFilter = 'OPEN' | 'RESOLVED' | 'ALL';

const TAB_CFG: Record<Exclude<StatusFilter, 'ALL'>, { label: string; activeClass: string }> = {
  OPEN:     { label: 'Open',     activeClass: 'bg-amber-500 text-white shadow-sm' },
  RESOLVED: { label: 'Resolved', activeClass: 'bg-green-600 text-white shadow-sm' },
};

function getAuthToken() {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('token') || '';
}

function authedFetcher(url: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${getAuthToken()}` } }).then(async r => {
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.message || 'Request failed');
    }
    return r.json();
  });
}

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SupportTicketsPage() {
  const [filter, setFilter] = useState<StatusFilter>('OPEN');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (filter !== 'ALL') params.set('status', filter);
  const swrKey = `/api/dashboard/support-tickets?${params.toString()}`;
  const { data, isLoading, mutate } = useSWR<ApiResponse>(swrKey, authedFetcher);

  const counts = data?.counts ?? { OPEN: 0, RESOLVED: 0 };

  const tickets = useMemo(() => {
    const all = data?.tickets ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(t =>
      t.message.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      t.user.userId?.toLowerCase().includes(q) ||
      t.user.email?.toLowerCase().includes(q) ||
      t.user.mobile?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const setStatus = async (ticketId: string, status: 'OPEN' | 'RESOLVED') => {
    setUpdatingId(ticketId);
    try {
      const res = await fetch(`/api/dashboard/support-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        mutate();
      } else {
        alert('Failed to update ticket status');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const sendReply = async (ticketId: string) => {
    const response = (replyDrafts[ticketId] || '').trim();
    if (!response) return;
    setReplyingId(ticketId);
    try {
      const res = await fetch(`/api/dashboard/support-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ response }),
      });
      if (res.ok) {
        setReplyDrafts(prev => ({ ...prev, [ticketId]: '' }));
        mutate();
      } else {
        alert('Failed to send response');
      }
    } finally {
      setReplyingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Support Tickets</h1>
          <p className="text-xs text-gray-500 mt-0.5">Help & Support queries submitted by app users</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(TAB_CFG) as Exclude<StatusFilter, 'ALL'>[]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
              filter === s ? TAB_CFG[s].activeClass : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wide">{TAB_CFG[s].label}</span>
            <span className="text-lg font-black">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by message, category, user ID, email, mobile…"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#014584]/20"
        />
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm flex flex-col items-center gap-2">
          <LifeBuoy size={28} className="text-gray-300" />
          No support tickets{filter !== 'ALL' ? ` in "${TAB_CFG[filter].label}"` : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map(t => {
            const isOpenRow = expanded === t.id;
            const busy = updatingId === t.id;
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Row header */}
                <button
                  onClick={() => setExpanded(isOpenRow ? null : t.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 bg-blue-100 text-blue-600 overflow-hidden">
                    {t.user.avatarUrl
                      ? // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : (t.user.userId?.[0]?.toUpperCase() ?? '?')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-[#004f9f] truncate">{t.user.userId}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        t.type === 'REMARK' ? 'text-purple-600 bg-purple-50 border border-purple-100' : 'text-indigo-600 bg-indigo-50 border border-indigo-100'
                      }`}>
                        {t.type === 'REMARK' ? 'Remark' : 'Technical'}
                      </span>
                      {t.category && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full shrink-0">
                          {t.category}
                        </span>
                      )}
                      {t.adminResponse && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full shrink-0">
                          <MessageSquare size={9} /> Replied
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{t.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                      t.status === 'OPEN' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'
                    }`}>
                      {t.status === 'OPEN' ? <Clock size={9} /> : <CheckCircle size={9} />}
                      {t.status === 'OPEN' ? 'Open' : 'Resolved'}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(t.createdAt)}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpenRow && (
                  <div className="border-t border-gray-100 p-4 space-y-3 bg-[#F8FAFF]">
                    {/* Contact info */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                      {t.user.email && (
                        <span className="flex items-center gap-1"><Mail size={12} className="text-gray-400" /> {t.user.email}</span>
                      )}
                      {t.user.mobile && (
                        <span className="flex items-center gap-1"><Phone size={12} className="text-gray-400" /> {t.user.mobile}</span>
                      )}
                      {t.user.olympiadId && (
                        <span className="text-gray-400">Olympiad ID: <span className="font-mono text-gray-600">{t.user.olympiadId}</span></span>
                      )}
                    </div>

                    {/* Full message */}
                    <div className="bg-white border border-gray-100 rounded-xl p-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.message}</p>
                    </div>

                    {/* Screenshots */}
                    {t.screenshotUrls.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                          <ImageIcon size={12} /> Screenshots ({t.screenshotUrls.length})
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {t.screenshotUrls.map((url, i) => (
                            <button key={i} onClick={() => setLightbox(url)} className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resolved info */}
                    {t.status === 'RESOLVED' && t.resolvedAt && (
                      <p className="text-[11px] text-green-600">Resolved on {formatDate(t.resolvedAt)}</p>
                    )}

                    {/* Existing SuperAdmin response */}
                    {t.adminResponse && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <p className="text-[11px] font-bold text-blue-600 mb-1 flex items-center gap-1">
                          <MessageSquare size={12} /> Your response {t.respondedAt ? `· ${formatDate(t.respondedAt)}` : ''}
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.adminResponse}</p>
                      </div>
                    )}

                    {/* Reply box */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-gray-500">{t.adminResponse ? 'Send another response' : 'Write a response'}</p>
                      <textarea
                        value={replyDrafts[t.id] || ''}
                        onChange={e => setReplyDrafts(prev => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Type your response to the user…"
                        rows={3}
                        className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#014584]/20 resize-none"
                      />
                      <button
                        onClick={() => sendReply(t.id)}
                        disabled={replyingId === t.id || !(replyDrafts[t.id] || '').trim()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#014584] hover:bg-[#013a6e] text-white text-xs font-black transition-colors disabled:opacity-40"
                      >
                        <Send size={13} /> {replyingId === t.id ? 'Sending...' : 'Send Response'}
                      </button>
                    </div>

                    {/* Status action */}
                    <div className="flex gap-2 pt-1">
                      {t.status === 'OPEN' ? (
                        <button
                          onClick={() => setStatus(t.id, 'RESOLVED')}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-black transition-colors disabled:opacity-50"
                        >
                          <CheckCircle size={13} /> {busy ? 'Working...' : 'Mark Resolved'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setStatus(t.id, 'OPEN')}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-colors disabled:opacity-50"
                        >
                          <Clock size={13} /> {busy ? 'Working...' : 'Reopen'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
