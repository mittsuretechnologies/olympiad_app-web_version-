'use client';

import { useEffect, useState } from 'react';
import {
  Play, CheckCircle, XCircle, Clock, MapPin, School,
  Eye, Globe, Lock, Award, RefreshCw, User,
} from 'lucide-react';

interface Video {
  id: string;
  videoUrl: string;
  caption: string;
  category: string;
  subCategory: string;
  tags: string;
  isPublic: boolean;
  isEvaluation: boolean;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  uploaderType: string | null;
  appUser: { userId: string; email: string | null; mobile: string | null; olympiadId: string | null } | null;
  student: {
    name: string;
    olympiadCode: string;
    allocation: {
      school: {
        name: string;
        city: string;
        district: string;
        state: string;
      };
    };
  } | null;
}

type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED';

export default function VideoModerationPage() {
  const [videos, setVideos]             = useState<Video[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState<StatusFilter>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [rejectModal, setRejectModal]   = useState<{ video: Video } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { fetchVideos(); }, [filter]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/dashboard/videos?status=${filter}`);
      const data = await res.json();
      setVideos(Array.isArray(data) ? data : []);
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (video: Video) => {
    setProcessingId(video.id);
    try {
      const res = await fetch('/api/dashboard/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, status: 'APPROVED' }),
      });
      if (res.ok) {
        setVideos(vs => vs.filter(v => v.id !== video.id));
        if (previewVideo?.id === video.id) setPreviewVideo(null);
      } else alert('Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (video: Video) => {
    setRejectReason('');
    setRejectModal({ video });
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) { alert('Please enter a rejection reason.'); return; }
    const video = rejectModal.video;
    setRejectModal(null);
    setProcessingId(video.id);
    try {
      const res = await fetch('/api/dashboard/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, status: 'REJECTED', rejectionReason: rejectReason.trim() }),
      });
      if (res.ok) {
        setVideos(vs => vs.filter(v => v.id !== video.id));
        if (previewVideo?.id === video.id) setPreviewVideo(null);
      } else alert('Failed to reject');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const TAB_CFG = {
    PENDING:  { icon: Clock,         activeClass: 'bg-amber-500 text-white shadow-md' },
    APPROVED: { icon: CheckCircle,   activeClass: 'bg-green-600 text-white shadow-md' },
    REJECTED: { icon: XCircle,       activeClass: 'bg-red-600   text-white shadow-md' },
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#06013E]">Video Moderation</h1>
          <p className="text-sm text-gray-400 mt-0.5">Review, approve or reject student submissions</p>
        </div>
        <button
          onClick={fetchVideos}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 w-fit">
        {(Object.keys(TAB_CFG) as StatusFilter[]).map(s => {
          const Icon = TAB_CFG[s].icon;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black transition-all ${
                filter === s ? TAB_CFG[s].activeClass : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <Icon size={13} /> {s}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3">
          <Clock size={28} className="animate-spin text-gray-300" />
          <span className="text-gray-400 text-sm font-bold">Loading…</span>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-gray-200 rounded-2xl">
          <Play size={40} className="text-gray-200 mb-3" />
          <p className="text-gray-400 font-bold text-sm">No {filter.toLowerCase()} videos</p>
        </div>
      ) : (

        /* ── Compact list — one row per video ── */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Table header */}
          <div className="grid grid-cols-[80px_1fr_160px_130px_120px] gap-0 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <span>Thumbnail</span>
            <span>Details</span>
            <span>Student</span>
            <span>School</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Rows */}
          {videos.map((video, idx) => {
            const school  = video.student?.allocation?.school;
            const busy    = processingId === video.id;
            const tagList = video.tags ? video.tags.split(',').filter(Boolean) : [];
            const isLast  = idx === videos.length - 1;

            return (
              <div
                key={video.id}
                className={`grid grid-cols-[80px_1fr_160px_130px_120px] gap-0 px-4 py-3 items-center hover:bg-gray-50/60 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}
              >
                {/* Thumbnail — fixed 80×56 */}
                <div
                  className="w-[68px] h-[50px] rounded-lg overflow-hidden bg-black relative cursor-pointer group shrink-0"
                  onClick={() => setPreviewVideo(video)}
                >
                  <video
                    src={video.videoUrl}
                    className="w-full h-full object-cover opacity-90"
                    preload="metadata"
                    muted
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={14} className="text-white fill-current" />
                  </div>
                </div>

                {/* Details */}
                <div className="pl-3 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[10px] font-black text-[#014584] bg-blue-50 px-2 py-0.5 rounded-full">
                      {video.subCategory || video.category}
                    </span>
                    {video.isEvaluation && (
                      <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Award size={9} /> Jury
                      </span>
                    )}
                    <span className={`flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full ${video.isPublic ? 'text-blue-600 bg-blue-50' : 'text-purple-600 bg-purple-50'}`}>
                      {video.isPublic ? <Globe size={9} /> : <Lock size={9} />}
                      {video.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  {video.caption ? (
                    <p className="text-xs text-gray-600 truncate max-w-[260px] italic">"{video.caption}"</p>
                  ) : (
                    <p className="text-xs text-gray-300 italic">No caption</p>
                  )}
                  {tagList.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {tagList.slice(0, 3).map(t => (
                        <span key={t} className="text-[9px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">#{t}</span>
                      ))}
                      {tagList.length > 3 && <span className="text-[9px] text-gray-400">+{tagList.length - 3}</span>}
                    </div>
                  )}
                  {video.status === 'REJECTED' && video.rejectionReason && (
                    <p className="text-[10px] text-red-500 mt-1 truncate max-w-[260px]">✕ {video.rejectionReason}</p>
                  )}
                  <p className="text-[10px] text-gray-300 mt-0.5">{formatDate(video.createdAt)}</p>
                </div>

                {/* Uploader */}
                <div className="min-w-0 px-2">
                  {/* Uploader type badge */}
                  <div className="mb-1">
                    {(video.uploaderType === 'STUDENT' || video.student) ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        🎓 STUDENT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">
                        👁 VIEWER
                      </span>
                    )}
                  </div>
                  {/* Student record (school-registered) */}
                  {video.student ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#014584]/10 flex items-center justify-center text-[9px] font-black text-[#014584] shrink-0">
                        {video.student.name?.[0] ?? <User size={9} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[#06013E] truncate">{video.student.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono truncate">{video.student.olympiadCode}</p>
                      </div>
                    </div>
                  ) : video.appUser ? (
                    /* App user (viewer or student-via-app) */
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-700 truncate font-mono">{video.appUser.userId}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {video.appUser.email || video.appUser.mobile || '—'}
                      </p>
                      {video.appUser.olympiadId && (
                        <p className="text-[10px] text-amber-600 font-mono truncate">{video.appUser.olympiadId}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-300">—</p>
                  )}
                </div>

                {/* School */}
                <div className="min-w-0 px-2">
                  {school ? (
                    <>
                      <div className="flex items-center gap-1">
                        <School size={10} className="text-gray-400 shrink-0" />
                        <p className="text-[11px] text-gray-600 font-semibold truncate">{school.name}</p>
                      </div>
                      {(school.district || school.state) && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <MapPin size={9} className="text-gray-300 shrink-0" />
                          <p className="text-[10px] text-gray-400 truncate">
                            {[school.district, school.state].filter(Boolean).join(', ')}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-300">—</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => setPreviewVideo(video)}
                    disabled={busy}
                    title="Preview"
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40"
                  >
                    <Eye size={13} />
                  </button>

                  {filter === 'PENDING' && (
                    <>
                      <button
                        onClick={() => approve(video)}
                        disabled={busy}
                        title="Approve"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-black transition-colors disabled:opacity-40"
                      >
                        {busy ? <Clock size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                        OK
                      </button>
                      <button
                        onClick={() => openRejectModal(video)}
                        disabled={busy}
                        title="Reject"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[11px] font-black transition-colors disabled:opacity-40"
                      >
                        <XCircle size={11} /> No
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Video preview modal ── */}
      {previewVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-6"
          onClick={() => setPreviewVideo(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden w-full max-w-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Video — capped height so portrait videos don't overflow */}
            <div className="bg-black flex items-center justify-center" style={{ maxHeight: 360 }}>
              <video
                src={previewVideo.videoUrl}
                controls
                autoPlay
                className="w-full max-h-[360px] object-contain"
              />
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* Uploader type badge */}
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full mb-1 ${
                    previewVideo.uploaderType === 'STUDENT' || previewVideo.student
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-blue-50 text-blue-600 border border-blue-200'
                  }`}>
                    {(previewVideo.uploaderType === 'STUDENT' || previewVideo.student) ? '🎓 Student' : '👁 Viewer'}
                  </span>
                  {previewVideo.student ? (
                    <>
                      <p className="font-black text-[#06013E] text-sm">{previewVideo.student.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{previewVideo.student.olympiadCode}</p>
                    </>
                  ) : previewVideo.appUser ? (
                    <>
                      <p className="font-black text-[#06013E] text-sm font-mono">{previewVideo.appUser.userId}</p>
                      <p className="text-[11px] text-gray-400">{previewVideo.appUser.email || previewVideo.appUser.mobile || '—'}</p>
                      {previewVideo.appUser.olympiadId && (
                        <p className="text-[11px] text-amber-600 font-mono">{previewVideo.appUser.olympiadId}</p>
                      )}
                    </>
                  ) : null}
                  <p className="text-[11px] text-gray-500 mt-0.5">{previewVideo.subCategory} · {previewVideo.category}</p>
                  {previewVideo.caption && (
                    <p className="text-xs text-gray-500 mt-1.5 italic">"{previewVideo.caption}"</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {previewVideo.isEvaluation && (
                    <span className="flex items-center gap-1 text-[11px] bg-amber-50 text-amber-600 px-2 py-1 rounded-full font-bold">
                      <Award size={10} /> Jury
                    </span>
                  )}
                  <span className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-bold ${previewVideo.isPublic ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    {previewVideo.isPublic ? <Globe size={10} /> : <Lock size={10} />}
                    {previewVideo.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>

              {filter === 'PENDING' && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => approve(previewVideo)}
                    disabled={processingId === previewVideo.id}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm transition-colors disabled:opacity-40"
                  >
                    <CheckCircle size={15} /> Approve
                  </button>
                  <button
                    onClick={() => openRejectModal(previewVideo)}
                    disabled={processingId === previewVideo.id}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm transition-colors disabled:opacity-40"
                  >
                    <XCircle size={15} /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reject reason modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <h2 className="text-base font-black text-[#06013E] mb-1">Reject Video</h2>
            <p className="text-xs text-gray-400 mb-3">The student will see this reason on their profile.</p>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 min-h-[90px]"
              placeholder="e.g. Video quality is too low…"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-black transition-colors"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
