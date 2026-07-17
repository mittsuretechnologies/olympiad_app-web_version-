'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Flag, RefreshCw, X, CheckCircle, Trash2, Play, AlertTriangle, Settings, Award, Eye } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportedVideo {
  videoId: string;
  thumbnailUrl: string | null;
  videoUrl: string;
  caption: string | null;
  category: string | null;
  subCategory: string | null;
  isEvaluation: boolean;
  ownerName: string;
  reportCount: number;
  latestCategory: string | null;
  latestReportDate: string | null;
}

interface ListResponse {
  threshold: number;
  videos: ReportedVideo[];
}

interface ReportDetail {
  id: string;
  category: string;
  customReason: string | null;
  resolved: boolean;
  createdAt: string;
  reporterName: string;
}

interface DetailVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  category: string | null;
  subCategory: string | null;
  isEvaluation: boolean;
  ownerName: string;
  createdAt: string;
  deletedAt: string | null;
}

interface DetailResponse {
  video: DetailVideo;
  reports: ReportDetail[];
}

const CATEGORY_LABELS: Record<string, string> = {
  ABUSIVE_CONTENT: 'Abusive Content',
  SPAM: 'Spam',
  HARASSMENT: 'Harassment/Bullying',
  HATE_SPEECH: 'Hate Speech',
  VIOLENCE: 'Violence',
  SEXUAL_CONTENT: 'Sexual Content',
  MISINFORMATION: 'Misinformation',
  COPYRIGHT: 'Copyright Violation',
  OTHER: 'Other',
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
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ReportedVideosPage() {
  const { data, isLoading, mutate } = useSWR<ListResponse>('/api/dashboard/reported-videos', authedFetcher);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionModal, setActionModal] = useState<{ videoId: string; action: 'ignore' | 'remove' } | null>(null);
  const [working, setWorking] = useState(false);
  const [thresholdEdit, setThresholdEdit] = useState(false);
  const [thresholdValue, setThresholdValue] = useState('');
  const [savingThreshold, setSavingThreshold] = useState(false);

  const videos = data?.videos ?? [];
  const threshold = data?.threshold ?? 10;

  const openDetail = async (videoId: string) => {
    setDetailLoading(true);
    try {
      const res = await authedFetcher(`/api/dashboard/reported-videos/${videoId}`);
      setDetail(res);
    } catch {
      alert('Failed to load report details');
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async () => {
    if (!actionModal) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/dashboard/reported-videos/${actionModal.videoId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ action: actionModal.action }),
      });
      if (res.ok) {
        mutate(cur => cur ? { ...cur, videos: cur.videos.filter(v => v.videoId !== actionModal.videoId) } : cur, { revalidate: false });
        if (detail?.video.id === actionModal.videoId) setDetail(null);
      } else {
        alert('Action failed');
      }
    } finally {
      setWorking(false);
      setActionModal(null);
    }
  };

  const openThresholdEdit = () => {
    setThresholdValue(String(threshold));
    setThresholdEdit(true);
  };

  const saveThreshold = async () => {
    const value = parseInt(thresholdValue, 10);
    if (!Number.isFinite(value) || value < 1) { alert('Enter a valid positive number'); return; }
    setSavingThreshold(true);
    try {
      const res = await fetch('/api/settings/report-threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ threshold: value }),
      });
      if (res.ok) {
        mutate();
        setThresholdEdit(false);
      } else {
        alert('Failed to update threshold');
      }
    } finally {
      setSavingThreshold(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Reported Videos</h1>
          <p className="text-xs text-gray-500 mt-0.5">Videos with report count ≥ threshold ({threshold})</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openThresholdEdit}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Settings size={13} /> Threshold
          </button>
          <button
            onClick={() => mutate()}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Card grid */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm flex flex-col items-center gap-2">
          <Flag size={28} className="text-gray-300" />
          No videos have reached the report threshold.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map(v => (
            <div
              key={v.videoId}
              className="group relative bg-[#F0F4FF] rounded-2xl border border-[#C7D8FF] overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            >
              {/* Thumbnail */}
              <div
                className="relative w-full aspect-video bg-black cursor-pointer overflow-hidden"
                onClick={() => openDetail(v.videoId)}
              >
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <video src={v.videoUrl} className="w-full h-full object-cover" preload="metadata" muted />
                )}

                {/* Dark overlay on hover */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play size={18} className="text-white fill-current ml-0.5" />
                  </div>
                </div>

                {/* Top-right: report count / jury badges */}
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                  <span className="flex items-center gap-1 text-[10px] font-black text-white bg-red-600 px-2 py-0.5 rounded-full shadow">
                    <Flag size={9} /> {v.reportCount}
                  </span>
                  {v.isEvaluation && (
                    <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-700 bg-amber-400 px-2 py-0.5 rounded-full shadow">
                      <Award size={9} /> Jury
                    </span>
                  )}
                </div>

                {/* Bottom gradient + date */}
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/60 to-transparent flex items-end px-2.5 pb-1.5">
                  <span className="text-[10px] text-white/70 font-medium">{formatDate(v.latestReportDate)}</span>
                </div>
              </div>

              {/* Card body */}
              <div className="p-3 space-y-2 bg-[#F0F4FF]">
                {/* Badges row */}
                <div className="flex items-center gap-1 flex-wrap">
                  {(v.subCategory || v.category) && (
                    <span className="text-[10px] font-black text-[#014584] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full truncate max-w-[140px]">
                      {v.subCategory || v.category}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full border ml-auto text-red-600 bg-red-50 border-red-100">
                    <AlertTriangle size={8} />
                    {v.latestCategory ? CATEGORY_LABELS[v.latestCategory] ?? v.latestCategory : 'Reported'}
                  </span>
                </div>

                {/* Caption */}
                {v.caption && (
                  <p className="text-[11px] font-semibold text-gray-700 bg-gray-100 rounded-lg px-2 py-1 truncate">
                    {v.caption}
                  </p>
                )}

                {/* Divider + owner row */}
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 bg-blue-100 text-blue-600">
                      {v.ownerName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-[#004f9f] truncate">{v.ownerName}</p>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => openDetail(v.videoId)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-[11px] font-bold transition-colors"
                  >
                    <Eye size={12} /> View
                  </button>
                  <button
                    onClick={() => setActionModal({ videoId: v.videoId, action: 'ignore' })}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-black px-2 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <CheckCircle size={12} /> Ignore
                  </button>
                  <button
                    onClick={() => setActionModal({ videoId: v.videoId, action: 'remove' })}
                    className="px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-[#0f0f0f] rounded-2xl overflow-hidden w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            {detailLoading || !detail ? (
              <div className="p-16 text-center text-gray-400 text-sm">Loading...</div>
            ) : (
              <>
                <div className="bg-black flex items-center justify-center relative" style={{ maxHeight: 340 }}>
                  <video src={detail.video.videoUrl} controls autoPlay className="w-full max-h-[340px] object-contain" />
                  <button onClick={() => setDetail(null)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center transition-colors">
                    <X size={14} className="text-white" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {/* Category + jury badge row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(detail.video.category || detail.video.subCategory) && (
                        <span className="text-[11px] font-black text-blue-300 bg-white/10 px-2.5 py-1 rounded-full">
                          {detail.video.subCategory || detail.video.category}
                        </span>
                      )}
                      {detail.video.isEvaluation && (
                        <span className="flex items-center gap-1 text-[10px] font-black bg-amber-400 text-amber-900 px-2 py-1 rounded-full">
                          <Award size={10} /> Jury
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-white/30">{formatDate(detail.video.createdAt)}</span>
                  </div>

                  {/* Caption */}
                  {detail.video.caption && (
                    <p className="text-sm font-semibold text-white bg-white/10 rounded-xl px-3 py-2">{detail.video.caption}</p>
                  )}

                  {/* Owner */}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 bg-blue-500/20 text-blue-300">
                      {detail.video.ownerName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <p className="text-[12px] font-black text-white/80">{detail.video.ownerName}</p>
                  </div>

                  {/* Reports */}
                  <div>
                    <h3 className="text-xs font-black text-white/60 uppercase tracking-wide mb-2">Reports ({detail.reports.length})</h3>
                    <div className="space-y-2">
                      {detail.reports.map(r => (
                        <div key={r.id} className="border border-white/10 bg-white/5 rounded-lg p-2.5 text-xs flex items-start gap-2">
                          <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-white/90">{CATEGORY_LABELS[r.category] ?? r.category} — {r.reporterName}</p>
                            {r.customReason && <p className="text-white/60 mt-0.5">{r.customReason}</p>}
                            <p className="text-white/30 mt-0.5">{formatDate(r.createdAt)}{r.resolved ? ' · resolved' : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setActionModal({ videoId: detail.video.id, action: 'ignore' })}
                      className="flex-1 flex items-center justify-center gap-1 text-[12px] font-black px-3 py-2.5 rounded-xl bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                    >
                      <CheckCircle size={13} /> Ignore
                    </button>
                    <button
                      onClick={() => setActionModal({ videoId: detail.video.id, action: 'remove' })}
                      className="flex-1 flex items-center justify-center gap-1 text-[12px] font-black px-3 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Action confirm modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">
              {actionModal.action === 'remove' ? 'Remove this video?' : 'Ignore these reports?'}
            </h3>
            <p className="text-sm text-gray-500">
              {actionModal.action === 'remove'
                ? 'The video will be hidden from all users but retained for records.'
                : 'The current reports will be marked resolved and the video removed from this queue.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm font-semibold text-gray-500 rounded-lg hover:bg-gray-100">Cancel</button>
              <button
                onClick={runAction}
                disabled={working}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 ${actionModal.action === 'remove' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#004f9f] hover:bg-[#014584]'}`}
              >
                {working ? 'Working...' : actionModal.action === 'remove' ? 'Remove' : 'Ignore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Threshold edit modal */}
      {thresholdEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-base font-semibold text-gray-800">Report Threshold</h3>
            <p className="text-sm text-gray-500">Videos need this many reports before appearing in this queue.</p>
            <input
              type="number"
              min={1}
              value={thresholdValue}
              onChange={e => setThresholdValue(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setThresholdEdit(false)} className="px-4 py-2 text-sm font-semibold text-gray-500 rounded-lg hover:bg-gray-100">Cancel</button>
              <button
                onClick={saveThreshold}
                disabled={savingThreshold}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg bg-[#004f9f] hover:bg-[#014584] disabled:opacity-50"
              >
                {savingThreshold ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
