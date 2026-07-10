'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Video, Star, Eye, Heart, BookOpen, Search,
  Filter, Calendar, Tag, Loader2, Share2, Check, Lock, Globe, ShieldCheck, X
} from 'lucide-react';
import { getCategoryDisplayLabel } from '@/lib/olympiad-categories';

interface VideoItem {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string;
  category: string;
  subCategory: string;
  tags: string;
  isEvaluation: boolean;
  olympiadVisibility: 'public' | 'private' | null;
  uploaderType: string;
  status: string;
  likesCount: number;
  viewsCount: number;
  createdAt: string;
  studentName: string;
  username: string | null;
  studentId: string | null;
  olympiadCode: string;
  classCode: string | null;
  className: string | null;
  source: 'web' | 'app';
}

const STEP_UP_STORAGE_KEY = 'schoolVisibilityStepUp';

function getCachedStepUpToken(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STEP_UP_STORAGE_KEY);
  if (!raw) return null;
  try {
    const { token, expiresAt } = JSON.parse(raw);
    if (Date.now() >= expiresAt) {
      sessionStorage.removeItem(STEP_UP_STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function cacheStepUpToken(token: string, expiresInSeconds: number) {
  sessionStorage.setItem(STEP_UP_STORAGE_KEY, JSON.stringify({
    token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  }));
}

function clearCachedStepUpToken() {
  sessionStorage.removeItem(STEP_UP_STORAGE_KEY);
}

const avatarGradients = [
  'from-[#1559C7] to-[#2a78d6]',
  'from-[#0d9f6e] to-[#1baf7a]',
  'from-[#4a3aa7] to-[#7a6ad6]',
  'from-[#e34948] to-[#eb6834]',
  'from-[#d98600] to-[#eda100]',
];

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function StudentVideosPage() {
  const [videos, setVideos]     = useState<VideoItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'OLYMPIAD' | 'GENERAL'>('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [playing, setPlaying]   = useState<string | null>(null);

  // Pending visibility change awaiting OTP step-up verification, if any
  const [pendingVisibility, setPendingVisibility] = useState<{ videoId: string; next: 'public' | 'private' } | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') || '' : '';

  useEffect(() => {
    fetch('/api/school/me/student-videos', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : r.json().then((e: any) => Promise.reject(e.message)))
      .then(setVideos)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [token]);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of videos) {
      if (v.classCode) map.set(v.classCode, v.className || v.classCode);
    }
    return Array.from(map.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [videos]);

  const filtered = useMemo(() => {
    return videos.filter(v => {
      if (typeFilter === 'OLYMPIAD' && !v.isEvaluation) return false;
      if (typeFilter === 'GENERAL' && v.isEvaluation) return false;
      if (classFilter !== 'ALL' && (v.classCode || '') !== classFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !v.studentName.toLowerCase().includes(q) &&
          !(v.username || '').toLowerCase().includes(q) &&
          !v.olympiadCode.toLowerCase().includes(q) &&
          !getCategoryDisplayLabel(v.category).toLowerCase().includes(q) &&
          !v.subCategory.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [videos, typeFilter, classFilter, search]);

  const olympiadCount = videos.filter(v => v.isEvaluation).length;
  const generalCount  = videos.filter(v => !v.isEvaluation).length;

  // Applies a visibility change against the API using a valid step-up token.
  // Returns true on success, false if the step-up token was rejected (expired/invalid).
  const applyVisibilityChange = async (videoId: string, next: 'public' | 'private', stepUpToken: string): Promise<boolean> => {
    const res = await fetch(`/api/school/me/videos/${videoId}/visibility`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-step-up-token': stepUpToken,
      },
      body: JSON.stringify({ olympiadVisibility: next }),
    });
    if (res.status === 401) {
      clearCachedStepUpToken();
      return false;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update visibility');
    setVideos(prev => prev.map(v => v.id === videoId ? { ...v, olympiadVisibility: next } : v));
    return true;
  };

  const handleToggleVisibility = async (video: VideoItem) => {
    const next: 'public' | 'private' = video.olympiadVisibility === 'private' ? 'public' : 'private';
    const cached = getCachedStepUpToken();
    if (cached) {
      try {
        const ok = await applyVisibilityChange(video.id, next, cached);
        if (ok) return;
      } catch (e: any) {
        alert(e.message);
        return;
      }
    }
    // No valid cached step-up token — prompt for OTP verification first.
    setPendingVisibility({ videoId: video.id, next });
  };

  const handleVerified = async (stepUpToken: string, expiresIn: number) => {
    cacheStepUpToken(stepUpToken, expiresIn);
    if (!pendingVisibility) return;
    try {
      await applyVisibilityChange(pendingVisibility.videoId, pendingVisibility.next, stepUpToken);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPendingVisibility(null);
    }
  };

  return (
    <div className="space-y-4">

      {/* Header banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a3aa7] to-[#7a6ad6] p-6 text-white shadow-[0_8px_24px_rgba(74,58,167,0.25)]">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 right-24 w-28 h-28 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Video size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">School Panel</p>
              <h1 className="text-xl font-black tracking-tight">Student Video Submissions</h1>
            </div>
          </div>
          <span className="text-[11px] font-bold bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">{filtered.length} video{filtered.length !== 1 ? 's' : ''} shown</span>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1559C7] to-[#2a78d6] rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.12)] p-4 text-white">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
          <p className="relative text-[11px] font-semibold text-white/85">Total in Feed</p>
          <p className="relative text-2xl font-black mt-1">{videos.length}</p>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#d98600] to-[#eda100] rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.12)] p-4 text-white">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
          <p className="relative text-[11px] font-semibold text-white/85">Olympiad Entries</p>
          <p className="relative text-2xl font-black mt-1">{olympiadCount}</p>
        </div>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0d9f6e] to-[#1baf7a] rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.12)] p-4 text-white">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
          <p className="relative text-[11px] font-semibold text-white/85">General Feed</p>
          <p className="relative text-2xl font-black mt-1">{generalCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
          <input
            type="text"
            placeholder="Search student, ID, category"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#E7EBF2] rounded-full text-[12px] focus:outline-none focus:border-[#1559C7] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'OLYMPIAD', 'GENERAL'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-full transition-colors ${
                typeFilter === t ? 'bg-[#4a3aa7] text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t === 'ALL' ? 'All Videos' : t === 'OLYMPIAD' ? 'Olympiad' : 'General'}
            </button>
          ))}
        </div>

        {classes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-gray-400" />
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="text-[12px] border border-[#E7EBF2] rounded-full px-3 py-1.5 outline-none focus:border-[#1559C7] text-gray-700 bg-white"
            >
              <option value="ALL">All Classes</option>
              {classes.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] py-20 flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#1559C7]" />
          <p className="text-sm text-gray-500">Loading videos...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-red-200 py-16 text-center text-red-600 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] py-20 text-center text-gray-500 text-sm">
          {videos.length === 0 ? 'No approved videos from your students yet.' : 'No videos match your filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((v, i) => (
            <VideoCard
              key={v.id}
              video={v}
              avatarGradient={avatarGradients[i % avatarGradients.length]}
              isPlaying={playing === v.id}
              onPlay={() => setPlaying(playing === v.id ? null : v.id)}
              onToggleVisibility={() => handleToggleVisibility(v)}
            />
          ))}
        </div>
      )}

      {pendingVisibility && (
        <VisibilityOtpModal
          token={token}
          onVerified={handleVerified}
          onClose={() => setPendingVisibility(null)}
        />
      )}
    </div>
  );
}

function VisibilityOtpModal({ token, onVerified, onClose }: {
  token: string;
  onVerified: (stepUpToken: string, expiresIn: number) => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<'request' | 'enter'>('request');
  const [otp, setOtp] = useState('');
  const [channelMsg, setChannelMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const requestOtp = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/school/me/video-visibility/request-otp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
      setChannelMsg(data.message);
      setStage('enter');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { requestOtp(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const verify = async () => {
    if (!otp.trim()) { setError('Enter the OTP'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/school/me/video-visibility/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      onVerified(data.stepUpToken, data.expiresIn);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.2)] w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0d1a6e] to-[#1559C7] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-white" />
            <p className="text-white font-bold text-sm">Verify it&apos;s you</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-3.5">
          <p className="text-xs text-gray-500">
            Changing a student&apos;s video visibility requires verifying an OTP sent to your school&apos;s registered contact.
          </p>
          {stage === 'request' ? (
            <div className="py-6 flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#1559C7]" />
              <p className="text-xs text-gray-500">Sending OTP...</p>
            </div>
          ) : (
            <>
              {channelMsg && <p className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5">{channelMsg}</p>}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Enter OTP</label>
                <input
                  type="text" inputMode="numeric" placeholder="6-digit code" value={otp} autoFocus
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && verify()}
                  className="w-full rounded-xl border border-[#E7EBF2] px-3 py-2 text-sm tracking-widest focus:outline-none focus:border-[#1559C7] focus:ring-1 focus:ring-[#1559C7]"
                />
              </div>
            </>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-full border border-[#E7EBF2] text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={stage === 'request' ? requestOtp : verify} disabled={busy || stage === 'request'}
              className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-[#1559C7] to-[#2a78d6] text-white text-sm font-bold hover:shadow-[0_4px_14px_rgba(21,89,199,0.35)] transition-shadow disabled:opacity-50 flex items-center justify-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin" />}
              Verify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function shareVideo(v: VideoItem, onCopied: () => void) {
  const shareData = {
    title: `${v.studentName} — ${getCategoryDisplayLabel(v.category)}`,
    text: v.caption || `Check out this video by ${v.studentName}`,
    url: v.videoUrl,
  };
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // user cancelled or share failed — fall through to clipboard copy
    }
  }
  try {
    await navigator.clipboard.writeText(v.videoUrl);
    onCopied();
  } catch {
    // clipboard unavailable — nothing more we can do
  }
}

function VideoCard({ video: v, avatarGradient, isPlaying, onPlay, onToggleVisibility }: {
  video: VideoItem;
  avatarGradient: string;
  isPlaying: boolean;
  onPlay: () => void;
  onToggleVisibility: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isPrivate = v.olympiadVisibility === 'private';

  const handleShare = () => {
    shareVideo(v, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] overflow-hidden hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] transition-shadow">

      {/* Video player / thumbnail */}
      <div className="relative bg-black aspect-video">
        {isPlaying ? (
          <video
            src={v.videoUrl}
            controls
            autoPlay
            className="w-full h-full object-contain"
            onEnded={onPlay}
          />
        ) : (
          <button
            onClick={onPlay}
            className="w-full h-full flex items-center justify-center group relative"
          >
            {v.thumbnailUrl ? (
              <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#0d1a6e] to-[#1559C7] flex items-center justify-center">
                <Video className="w-10 h-10 text-white/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-[#1559C7] ml-1" />
              </div>
            </div>
          </button>
        )}

        {/* Olympiad badge — top left */}
        {v.isEvaluation && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-gradient-to-r from-[#d98600] to-[#eda100] text-white px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm">
            <Star className="w-2.5 h-2.5 fill-current" />
            OLYMPIAD
          </div>
        )}

        {/* Uploader type — top right */}
        {v.uploaderType === 'SCHOOL' && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-[#0d1a6e] to-[#1559C7] text-white px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm">
            By School
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-2.5">

        {/* Student info */}
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient} text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm`}>
            {getInitials(v.studentName)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-black text-sm truncate">{v.studentName}</p>
              {v.username && (
                <span className="text-[9px] font-semibold text-[#1559C7] bg-[#1559C7]/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  @{v.username}
                </span>
              )}
            </div>
            <p className="text-[10px] text-[#1559C7] font-mono font-semibold">{v.olympiadCode}</p>
          </div>
          {v.className && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1559C7]/10 text-[#1559C7] flex-shrink-0">
              <BookOpen className="w-2.5 h-2.5" />{v.className}
            </span>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{getCategoryDisplayLabel(v.category)}</span>
          {v.subCategory && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{v.subCategory}</span>
          )}
          {v.isEvaluation && (
            <button
              onClick={onToggleVisibility}
              title={isPrivate ? 'Private — click to make public' : 'Public — click to make private'}
              className={`ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                isPrivate ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-[#0d9f6e]/10 text-[#0d9f6e] hover:bg-[#0d9f6e]/20'
              }`}
            >
              {isPrivate ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
              {isPrivate ? 'Private' : 'Public'}
            </button>
          )}
        </div>

        {/* Caption */}
        {v.caption && (
          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{v.caption}</p>
        )}

        {/* Tags */}
        {v.tags && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />
            {v.tags.split(',').slice(0, 4).map(tag => (
              <span key={tag} className="text-[10px] text-gray-600 font-medium">#{tag.trim()}</span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-[#e34948]" />{v.likesCount}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-[#1559C7]" />{v.viewsCount}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <Calendar className="w-3 h-3" />
              {new Date(v.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <button
              onClick={handleShare}
              title={copied ? 'Link copied!' : 'Share'}
              className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
                copied ? 'bg-[#0d9f6e]/10 text-[#0d9f6e]' : 'bg-gray-100 text-gray-600 hover:bg-[#1559C7]/10 hover:text-[#1559C7]'
              }`}
            >
              {copied ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
