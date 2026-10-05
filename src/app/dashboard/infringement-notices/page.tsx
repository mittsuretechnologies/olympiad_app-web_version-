'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  ShieldAlert, RefreshCw, Clock, CheckCircle, XCircle, Mail, Phone, Search, FileText, Link2, Save, AlertTriangle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type Status = 'PENDING' | 'CONTENT_REMOVED' | 'REJECTED';

interface Notice {
  id: string;
  referenceId: string;
  role: string;
  fullName: string;
  organisation: string | null;
  email: string;
  phone: string;
  videoLink: string;
  rightTypes: string;
  workTypes: string;
  noticeText: string;
  files: { name: string; kind: 'ownership' | 'authority'; contentType: string; size: number }[];
  emailSent: boolean;
  status: Status;
  adminNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface ApiResponse {
  counts: Record<Status, number>;
  notices: Notice[];
}

type Filter = Status | 'ALL';

const STATUS_CFG: Record<Status, { label: string; activeClass: string; badge: string; icon: typeof Clock }> = {
  PENDING:         { label: 'Pending',         activeClass: 'bg-amber-500 text-white shadow-sm', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  CONTENT_REMOVED: { label: 'Content Removed', activeClass: 'bg-green-600 text-white shadow-sm', badge: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
  REJECTED:        { label: 'Rejected',        activeClass: 'bg-gray-600 text-white shadow-sm',  badge: 'bg-gray-100 text-gray-600 border-gray-200',  icon: XCircle },
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

export default function InfringementNoticesPage() {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});

  const swrKey = `/api/dashboard/infringement-notices${filter !== 'ALL' ? `?status=${filter}` : ''}`;
  const { data, isLoading, error, mutate } = useSWR<ApiResponse>(swrKey, authedFetcher);

  const counts = data?.counts ?? { PENDING: 0, CONTENT_REMOVED: 0, REJECTED: 0 };

  const notices = useMemo(() => {
    const all = data?.notices ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(n =>
      [n.referenceId, n.fullName, n.organisation, n.email, n.phone, n.videoLink, n.noticeText]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [data, search]);

  const update = async (noticeId: string, body: { status?: Status; adminNotes?: string }) => {
    setUpdatingId(noticeId);
    try {
      const res = await fetch(`/api/dashboard/infringement-notices/${noticeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        alert('Failed to update notice');
        return;
      }
      if (body.adminNotes !== undefined) setNotesDrafts(prev => { const next = { ...prev }; delete next[noticeId]; return next; });
      mutate();
    } finally {
      setUpdatingId(null);
    }
  };

  // The window is opened synchronously so the browser doesn't treat it as a popup.
  const openFile = async (noticeId: string, index: number) => {
    const win = window.open('', '_blank');
    try {
      const res = await fetch(`/api/dashboard/infringement-notices/${noticeId}/files/${index}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch {
      win?.close();
      alert('Could not open the file');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Report Infringement</h1>
          <p className="text-xs text-gray-500 mt-0.5">Copyright and trademark notices submitted on mittmee.com</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.keys(STATUS_CFG) as Status[]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? 'ALL' : s)}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
              filter === s ? STATUS_CFG[s].activeClass : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wide">{STATUS_CFG[s].label}</span>
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
          placeholder="Search by reference, name, email, phone, video link…"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#014584]/20"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-500 text-sm">{error.message}</div>
      ) : notices.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm flex flex-col items-center gap-2">
          <ShieldAlert size={28} className="text-gray-300" />
          No infringement notices{filter !== 'ALL' ? ` in "${STATUS_CFG[filter].label}"` : ''}.
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(n => {
            const isOpenRow = expanded === n.id;
            const busy = updatingId === n.id;
            const cfg = STATUS_CFG[n.status] ?? STATUS_CFG.PENDING;
            const StatusIcon = cfg.icon;
            const notesValue = notesDrafts[n.id] ?? n.adminNotes ?? '';
            return (
              <div key={n.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Row header */}
                <button
                  onClick={() => setExpanded(isOpenRow ? null : n.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-red-50 text-red-500">
                    <ShieldAlert size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-[#004f9f] truncate">{n.fullName}</p>
                      <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full shrink-0">
                        {n.referenceId}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full shrink-0">
                        {n.rightTypes}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{n.videoLink}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                      <StatusIcon size={9} /> {cfg.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(n.createdAt)}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpenRow && (
                  <div className="border-t border-gray-100 p-4 space-y-3 bg-[#F8FAFF]">
                    {/* Contact */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                      <a href={`mailto:${n.email}?subject=${encodeURIComponent(`Your infringement notice ${n.referenceId}`)}`} className="flex items-center gap-1 hover:text-[#004f9f]">
                        <Mail size={12} className="text-gray-400" /> {n.email}
                      </a>
                      <span className="flex items-center gap-1"><Phone size={12} className="text-gray-400" /> {n.phone}</span>
                      {n.organisation && <span className="text-gray-400">Organisation: <span className="text-gray-600">{n.organisation}</span></span>}
                      <span className="text-gray-400">Submitting as: <span className="text-gray-600">{n.role}</span></span>
                    </div>

                    {!n.emailSent && (
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <AlertTriangle size={12} /> This notice was not delivered to the grievance inbox by email — it exists only here.
                      </p>
                    )}

                    {/* Reported video */}
                    <p className="flex items-center gap-1.5 text-xs text-gray-600 break-all">
                      <Link2 size={12} className="text-gray-400 shrink-0" />
                      Reported video:{' '}
                      {/^https?:\/\//i.test(n.videoLink)
                        ? <a href={n.videoLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#004f9f] underline">{n.videoLink}</a>
                        : <span className="font-mono font-semibold">{n.videoLink}</span>}
                    </p>

                    {/* Proof documents */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                        <FileText size={12} /> Proof documents ({n.files.length})
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        {n.files.map((f, i) => (
                          <button
                            key={i}
                            onClick={() => openFile(n.id, i)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-[#004f9f] hover:bg-blue-50 transition-colors"
                          >
                            <FileText size={12} />
                            {f.kind === 'authority' ? 'Authority' : 'Ownership'} · {f.name} ({Math.ceil(f.size / 1024)} KB)
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Full notice */}
                    <div className="bg-white border border-gray-100 rounded-xl p-3 max-h-96 overflow-auto">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{n.noticeText}</pre>
                    </div>

                    {/* Internal notes */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-gray-500">Internal notes (not shared with the complainant)</p>
                      <textarea
                        value={notesValue}
                        onChange={e => setNotesDrafts(prev => ({ ...prev, [n.id]: e.target.value }))}
                        placeholder="e.g. Video removed on 3 Oct, uploader informed…"
                        rows={3}
                        className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#014584]/20 resize-none"
                      />
                      <button
                        onClick={() => update(n.id, { adminNotes: notesValue })}
                        disabled={busy || notesDrafts[n.id] === undefined}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#014584] hover:bg-[#013a6e] text-white text-xs font-black transition-colors disabled:opacity-40"
                      >
                        <Save size={13} /> Save Notes
                      </button>
                    </div>

                    {/* Status actions */}
                    <div className="flex gap-2 pt-1 flex-wrap items-center">
                      {n.status !== 'CONTENT_REMOVED' && (
                        <button
                          onClick={() => update(n.id, { status: 'CONTENT_REMOVED' })}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-black transition-colors disabled:opacity-50"
                        >
                          <CheckCircle size={13} /> Mark Content Removed
                        </button>
                      )}
                      {n.status !== 'REJECTED' && (
                        <button
                          onClick={() => update(n.id, { status: 'REJECTED' })}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-600 hover:bg-gray-700 text-white text-xs font-black transition-colors disabled:opacity-50"
                        >
                          <XCircle size={13} /> Reject Notice
                        </button>
                      )}
                      {n.status !== 'PENDING' && (
                        <button
                          onClick={() => update(n.id, { status: 'PENDING' })}
                          disabled={busy}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-colors disabled:opacity-50"
                        >
                          <Clock size={13} /> Move back to Pending
                        </button>
                      )}
                      {n.resolvedAt && n.status !== 'PENDING' && (
                        <span className="text-[11px] text-gray-500">Closed on {formatDate(n.resolvedAt)}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
