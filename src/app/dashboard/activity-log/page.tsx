'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { History, RefreshCw, Filter, X, ChevronLeft, ChevronRight, CheckCircle, XCircle, Trash2, Eye, Lock, Globe, Flag, Award, Star } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  actorId: string;
  actorRole: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
}

interface ListResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ACTION_CFG: Record<string, { label: string; icon: any; color: string }> = {
  VIDEO_APPROVED:        { label: 'Video Approved',       icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-100' },
  VIDEO_REJECTED:        { label: 'Video Rejected',       icon: XCircle,     color: 'text-red-600 bg-red-50 border-red-100' },
  VIDEO_DELETED:         { label: 'Video Deleted',        icon: Trash2,      color: 'text-red-700 bg-red-50 border-red-100' },
  VISIBILITY_CHANGED:    { label: 'Visibility Changed',   icon: Eye,         color: 'text-purple-600 bg-purple-50 border-purple-100' },
  REPORT_IGNORED:        { label: 'Report Ignored',       icon: Flag,        color: 'text-gray-600 bg-gray-50 border-gray-200' },
  REPORT_VIDEO_REMOVED:  { label: 'Reported Video Removed', icon: Flag,      color: 'text-red-700 bg-red-50 border-red-100' },
  EVALUATION_SUBMITTED:  { label: 'Evaluation Submitted',  icon: Star,       color: 'text-amber-600 bg-amber-50 border-amber-100' },
  EVALUATION_EDITED:     { label: 'Evaluation Edited',     icon: Star,       color: 'text-amber-600 bg-amber-50 border-amber-100' },
  EVALUATION_PUBLISHED:  { label: 'Evaluation Published',  icon: Award,      color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  EVALUATION_UNPUBLISHED:{ label: 'Evaluation Unpublished',icon: Award,      color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

const ACTION_OPTIONS = Object.keys(ACTION_CFG);
const ROLE_OPTIONS = ['SUPERADMIN', 'EVALUATOR', 'SCHOOL', 'REVIEWER'];

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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function tryParse(json: string | null) {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return json; }
}

function ValuePreview({ value }: { value: string | null }) {
  const parsed = tryParse(value);
  if (parsed === null) return <span className="text-gray-300">—</span>;
  if (typeof parsed === 'object') {
    return (
      <span className="font-mono text-[10px] text-gray-500">
        {Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(', ')}
      </span>
    );
  }
  return <span className="text-[10px] text-gray-500">{String(parsed)}</span>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ActivityLogPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [entityIdFilter, setEntityIdFilter] = useState('');
  const [entityIdInput, setEntityIdInput] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', '25');
  if (actionFilter) params.set('action', actionFilter);
  if (roleFilter) params.set('actorRole', roleFilter);
  if (entityIdFilter) params.set('entityId', entityIdFilter);

  const swrKey = `/api/dashboard/audit-log?${params.toString()}`;
  const { data, isLoading, mutate } = useSWR<ListResponse>(swrKey, authedFetcher);

  const logs = data?.logs ?? [];
  const activeFilters = [actionFilter, roleFilter, entityIdFilter].filter(Boolean).length;

  const applyEntityIdFilter = () => {
    setEntityIdFilter(entityIdInput.trim());
    setPage(1);
  };

  const clearFilters = () => {
    setActionFilter(''); setRoleFilter(''); setEntityIdFilter(''); setEntityIdInput('');
    setPage(1);
    setFilterOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Activity Log</h1>
          <p className="text-xs text-gray-500 mt-0.5">Every moderation & evaluation action — who did what, and when</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className={`flex items-center gap-2 h-9 px-3.5 rounded-xl border text-xs font-bold transition-colors ${
              activeFilters ? 'border-[#014584] bg-[#014584]/5 text-[#014584]' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Filter size={13} />
            Filters
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#014584] text-white text-[10px] font-black flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>

          {filterOpen && (
            <div className="absolute left-0 top-11 z-20 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 w-72 space-y-3">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Action</p>
                <select
                  value={actionFilter}
                  onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                  className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#014584]/30"
                >
                  <option value="">All actions</option>
                  {ACTION_OPTIONS.map(a => <option key={a} value={a}>{ACTION_CFG[a].label}</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Actor Role</p>
                <div className="flex flex-wrap gap-1.5">
                  {['', ...ROLE_OPTIONS].map(r => (
                    <button
                      key={r}
                      onClick={() => { setRoleFilter(r); setPage(1); }}
                      className={`px-2.5 h-7 rounded-lg text-[11px] font-bold border transition-colors ${
                        roleFilter === r ? 'bg-[#014584] text-white border-[#014584]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {r || 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Video / Entity ID</p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={entityIdInput}
                    onChange={e => setEntityIdInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyEntityIdFilter()}
                    placeholder="Paste an ID…"
                    className="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#014584]/30"
                  />
                  <button onClick={applyEntityIdFilter} className="h-8 px-2.5 rounded-lg bg-[#014584] text-white text-[11px] font-bold">Go</button>
                </div>
              </div>
              {activeFilters > 0 && (
                <button onClick={clearFilters} className="w-full h-7 text-[11px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {entityIdFilter && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#014584] bg-[#014584]/5 border border-[#014584]/20 px-2.5 py-1.5 rounded-xl">
            Entity: {entityIdFilter.slice(0, 8)}…
            <button onClick={() => { setEntityIdFilter(''); setEntityIdInput(''); }}><X size={11} /></button>
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-gray-200 rounded-2xl">
          <History size={40} className="text-gray-200 mb-3" />
          <p className="text-gray-400 font-bold text-sm">No activity recorded yet</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">When</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">By</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Entity</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Before → After</th>
                  <th className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const cfg = ACTION_CFG[log.action] ?? { label: log.action, icon: History, color: 'text-gray-600 bg-gray-50 border-gray-200' };
                  const Icon = cfg.icon;
                  return (
                    <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full border ${cfg.color}`}>
                          <Icon size={10} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[11px] font-bold text-gray-700">{log.actorName || log.actorId.slice(0, 8)}</p>
                        <p className="text-[10px] text-gray-400">{log.actorRole}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[11px] text-gray-500 font-mono">{log.entityType}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{log.entityId.slice(0, 8)}…</p>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ValuePreview value={log.previousValue} />
                          {log.previousValue && log.newValue && <span className="text-gray-300">→</span>}
                          <ValuePreview value={log.newValue} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-500 max-w-[200px] truncate">{log.reason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-[11px] text-gray-400">Page {data.page} of {data.totalPages} · {data.total} total</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
