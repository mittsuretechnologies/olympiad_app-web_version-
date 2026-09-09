'use client';

import { useMemo, useState, Fragment } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  Hash, Loader2, Search, Download, ChevronDown, ChevronUp,
  Users, Video, Play, X, Trophy,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */

interface CampaignVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  tags: string | null;
  category: string | null;
  subCategory: string | null;
  status: string;
  quality: string | null;
  createdAt: string;
  uploaderType: string;
}

interface UploaderGroup {
  uploaderKey: string;
  uploaderType: string;
  name: string;
  identifier: string;
  videoCount: number;
  videos: CampaignVideo[];
}

interface CampaignResponse {
  tag: string;
  totalVideos: number;
  totalUploaders: number;
  uploaders: UploaderGroup[];
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
    REJECTED: 'bg-red-50 text-red-600 border-red-200',
  };
  return map[status] || map.PENDING;
}

/* ── Main Page ────────────────────────────────────────────── */

export default function HashtagCampaignPage() {
  const [tagInput, setTagInput] = useState('mittfest');
  const [activeTag, setActiveTag] = useState('mittfest');
  const [search, setSearch] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<CampaignVideo | null>(null);

  const { data, isLoading: loading } = useSWR<CampaignResponse>(
    `/api/reports/hashtag-campaign?tag=${encodeURIComponent(activeTag)}`,
    fetcher
  );

  const uploaders: UploaderGroup[] = Array.isArray(data?.uploaders) ? data!.uploaders : [];

  const filtered = useMemo(() => {
    if (!search.trim()) return uploaders;
    const q = search.toLowerCase();
    return uploaders.filter(u =>
      u.name.toLowerCase().includes(q) || u.identifier.toLowerCase().includes(q)
    );
  }, [uploaders, search]);

  const runSearch = () => {
    const cleaned = tagInput.trim().replace(/^#/, '');
    if (cleaned) setActiveTag(cleaned);
  };

  const downloadCSV = () => {
    const header = ['Uploader', 'Identifier', 'Type', 'Video Count', 'Video ID', 'Status', 'Uploaded'];
    const csvRows: (string | number)[][] = [];
    filtered.forEach(u => {
      u.videos.forEach(v => {
        csvRows.push([
          u.name, u.identifier, u.uploaderType, u.videoCount,
          v.id, v.status, new Date(v.createdAt).toLocaleDateString('en-IN'),
        ]);
      });
    });
    const csv = [header, ...csvRows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `hashtag-${activeTag}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-medium text-[#004f9f]">Hashtag Campaign Report</h1>
        <button onClick={downloadCSV} disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all hover:shadow-md active:scale-95 disabled:opacity-40">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* ── Tag search ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input type="text" placeholder="mittfest" value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch()}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none" />
        </div>
        <button onClick={runSearch}
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-colors">
          Load Report
        </button>
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input type="text" placeholder="Search uploader name/ID…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
            <p className="text-gray-500 font-medium">Loading #{activeTag}…</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Tag', value: `#${data?.tag ?? activeTag}`, icon: <Hash size={18} />, color: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-200' },
              { label: 'Total Videos', value: data?.totalVideos ?? 0, icon: <Video size={18} />, color: 'from-purple-500 to-violet-600', shadow: 'shadow-purple-200' },
              { label: 'Unique Uploaders', value: data?.totalUploaders ?? 0, icon: <Users size={18} />, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-200' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${c.color} ${c.shadow} shadow-md flex items-center justify-center text-white`}>{c.icon}</div>
                  <span className="text-xs text-gray-400 font-semibold">{c.label}</span>
                </div>
                <p className="text-2xl font-extrabold text-gray-900 truncate">{c.value}</p>
              </div>
            ))}
          </div>

          {/* ── Table ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-8"></th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Uploader</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Identifier</th>
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Videos</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="py-16 text-center text-gray-400 font-medium">
                      No videos found with #{data?.tag ?? activeTag}.
                    </td></tr>
                  )}
                  {filtered.map((u, idx) => {
                    const isExpanded = expandedKey === u.uploaderKey;
                    return (
                      <Fragment key={u.uploaderKey}>
                        <tr
                          onClick={() => setExpandedKey(isExpanded ? null : u.uploaderKey)}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${isExpanded ? 'bg-rose-50/60' : 'hover:bg-gray-50'}`}>
                          <td className="py-3 px-4">
                            {isExpanded
                              ? <ChevronUp size={16} className="text-rose-500" />
                              : <ChevronDown size={16} className="text-gray-400" />}
                          </td>
                          <td className="py-3 px-4 text-gray-400 font-medium">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0">
                                {u.name.slice(0, 2).toUpperCase()}
                              </div>
                              <p className="font-bold text-gray-900 text-[13px]">{u.name}</p>
                              {idx === 0 && u.videoCount > 1 && (
                                <Trophy size={13} className="text-amber-400" />
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-gray-600 font-semibold">{u.identifier}</td>
                          <td className="py-3 px-4 text-gray-600 text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${u.uploaderType === 'STUDENT' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                              {u.uploaderType === 'STUDENT' ? '🎓 Student' : '📱 Viewer'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-extrabold text-gray-800">{u.videoCount}</span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="bg-rose-50/30 border-b border-rose-100 px-6 py-5">
                              <div className="grid gap-3">
                                {u.videos.map((v, vi) => (
                                  <div key={v.id}
                                    className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
                                    <button
                                      onClick={e => { e.stopPropagation(); setVideoModal(v); }}
                                      className="relative w-24 h-16 rounded-lg overflow-hidden bg-gray-900 flex-shrink-0 group">
                                      {v.thumbnailUrl ? (
                                        <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                                          <Video size={18} className="text-gray-500" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                                        <Play size={20} className="text-white drop-shadow-lg" />
                                      </div>
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-xs font-bold text-gray-700">Video {vi + 1}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(v.status)}`}>{v.status}</span>
                                        {v.subCategory && (
                                          <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{v.subCategory}</span>
                                        )}
                                      </div>
                                      {v.caption && <p className="text-xs text-gray-500 truncate">{v.caption}</p>}
                                      {v.tags && <p className="text-[11px] text-rose-500 truncate">#{v.tags.split(',').map(t => t.trim()).filter(Boolean).join(' #')}</p>}
                                      <p className="text-[10px] text-gray-400 mt-0.5">Uploaded: {new Date(v.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400 font-medium">
              Showing {filtered.length} of {uploaders.length} uploaders — sorted by video count (highest first)
            </div>
          </div>
        </>
      )}

      {/* ── Video Player Modal ── */}
      {videoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setVideoModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <span className="font-bold text-gray-800">Video Player</span>
              <button onClick={() => setVideoModal(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="aspect-video bg-black">
              <video src={videoModal.videoUrl} controls autoPlay className="w-full h-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
