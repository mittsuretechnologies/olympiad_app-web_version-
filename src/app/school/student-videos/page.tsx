'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Video, Clapperboard, Star, Eye, Heart, BookOpen, Search, Filter, Calendar, Tag,
  Loader2, Share2, Check, Lock, Globe, ShieldCheck, AlertCircle, ChevronRight,
} from 'lucide-react';
import { getCategoryDisplayLabel } from '@/lib/olympiad-categories';
import { CARD, STACK, INPUT, LABEL, FOCUS, BTN_PRIMARY, BTN_SECONDARY, TABLE, TH, TD, TR, avatarTint } from '../ui';
import {
  PageHeader, StatTile, StatusBadge, FilterPill, Avatar,
  LoadingState, ErrorState, EmptyState, ModalShell, TableShell, RowCount,
} from '../components';

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

  // Group the flat, filtered video list into one row per student so the
  // table stays scannable — the videos themselves only render once a row
  // is expanded, which is what keeps the page from feeling congested.
  const studentGroups = useMemo(() => {
    const map = new Map<string, {
      key: string; studentName: string; username: string | null; olympiadCode: string;
      className: string | null; videos: VideoItem[];
    }>();
    for (const v of filtered) {
      const key = v.studentId || v.olympiadCode || v.studentName;
      let g = map.get(key);
      if (!g) {
        g = { key, studentName: v.studentName, username: v.username, olympiadCode: v.olympiadCode, className: v.className, videos: [] };
        map.set(key, g);
      }
      g.videos.push(v);
    }
    return Array.from(map.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [filtered]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
    <div className={STACK}>

      <PageHeader
        icon={Clapperboard}
        title="Student Videos"
        subtitle="Submissions from your students"
        actions={
          // A live count belongs next to the data, not in the hover-only
          // subtitle — it changes as filters are applied.
          <span className="text-[12px] text-[#6B7280]">
            {filtered.length} of {videos.length} shown
          </span>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total in feed" value={videos.length} icon={Video} loading={loading} />
        <StatTile label="Olympiad entries" value={olympiadCount} icon={Star} loading={loading} />
        <StatTile label="General feed" value={generalCount} icon={Globe} loading={loading} />
      </div>

      {/* Toolbar */}
      <div className={`${CARD} flex flex-wrap items-center gap-2 px-3 py-2.5`}>
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={13} />
          <input
            type="text"
            placeholder="Search student, ID, category"
            aria-label="Search videos"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${INPUT} pl-8`}
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'OLYMPIAD', 'GENERAL'] as const).map(t => (
            <FilterPill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {t === 'ALL' ? 'All' : t === 'OLYMPIAD' ? 'Olympiad' : 'General'}
            </FilterPill>
          ))}
        </div>

        {classes.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <Filter size={13} className="text-[#9CA3AF]" />
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              aria-label="Filter by class"
              className={`${INPUT} !w-auto !py-1.5`}
            >
              <option value="ALL">All classes</option>
              {classes.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState label="Loading videos…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Video}
          title={videos.length === 0 ? 'No approved videos yet' : 'No videos match your filters'}
        />
      ) : (
        <TableShell footer={<RowCount shown={studentGroups.length} total={studentGroups.length} noun="students" />}>
          <table className={TABLE}>
            <thead>
              <tr>
                <TH_CELL className="w-8" />
                <TH_CELL>Student</TH_CELL>
                <TH_CELL>Class</TH_CELL>
                <TH_CELL>Olympiad ID</TH_CELL>
                <TH_CELL className="text-center">Videos</TH_CELL>
                <TH_CELL className="text-center">Olympiad</TH_CELL>
                <TH_CELL className="text-center">General</TH_CELL>
              </tr>
            </thead>
            <tbody>
              {studentGroups.map((g, i) => {
                const isOpen = expanded.has(g.key);
                const oCount = g.videos.filter(v => v.isEvaluation).length;
                const gCount = g.videos.length - oCount;
                return (
                  <React.Fragment key={g.key}>
                    <tr
                      className={`${TR} cursor-pointer`}
                      onClick={() => toggleExpanded(g.key)}
                      aria-expanded={isOpen}
                    >
                      <TD_CELL className="!py-2">
                        <ChevronRight
                          size={14}
                          className={`text-[#9CA3AF] transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                      </TD_CELL>
                      <TD_CELL className="!py-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={g.studentName} tint={avatarTint(i)} size={26} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-[#111827]">{g.studentName}</p>
                            {g.username && <p className="truncate text-[11px] text-[#6B7280]">@{g.username}</p>}
                          </div>
                        </div>
                      </TD_CELL>
                      <TD_CELL className="!py-2">
                        {g.className ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#EDF0F4] px-1.5 py-0.5 text-[11px] font-medium text-[#4B5563]">
                            <BookOpen className="h-2.5 w-2.5" />{g.className}
                          </span>
                        ) : (
                          <span className="text-[#9CA3AF]">—</span>
                        )}
                      </TD_CELL>
                      <TD_CELL className="!py-2 font-mono text-[12px] text-[#1559C7]">{g.olympiadCode}</TD_CELL>
                      <TD_CELL className="!py-2 text-center font-semibold text-[#111827]">{g.videos.length}</TD_CELL>
                      <TD_CELL className="!py-2 text-center">
                        {oCount > 0 ? <StatusBadge tone="info" icon={Star}>{oCount}</StatusBadge> : <span className="text-[#9CA3AF]">—</span>}
                      </TD_CELL>
                      <TD_CELL className="!py-2 text-center">
                        {gCount > 0 ? <StatusBadge tone="neutral" icon={Globe}>{gCount}</StatusBadge> : <span className="text-[#9CA3AF]">—</span>}
                      </TD_CELL>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="border border-[#E4E8EE] bg-[#FAFBFC] p-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                            {g.videos.map(v => (
                              <VideoCard
                                key={v.id}
                                video={v}
                                tint={avatarTint(i)}
                                isPlaying={playing === v.id}
                                onPlay={() => setPlaying(playing === v.id ? null : v.id)}
                                onToggleVisibility={() => handleToggleVisibility(v)}
                              />
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </TableShell>
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
    <ModalShell
      title={<span className="flex items-center gap-2"><ShieldCheck size={16} className="text-[#1559C7]" /> Verify it&apos;s you</span>}
      onClose={onClose}
      maxWidth="max-w-sm"
    >
      <div className="space-y-3 p-5">
        <p className="text-[12px] leading-relaxed text-[#4B5563]">
          Changing a student&apos;s video visibility requires verifying an OTP sent to your school&apos;s
          registered contact.
        </p>
        {stage === 'request' ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <Loader2 className="h-4 w-4 animate-spin text-[#1559C7]" />
            <p className="text-[12px] text-[#6B7280]">Sending OTP…</p>
          </div>
        ) : (
          <>
            {channelMsg && (
              <p className="rounded-lg bg-[#F6F7F9] px-3 py-2.5 text-[12px] text-[#4B5563]">{channelMsg}</p>
            )}
            <div>
              <label htmlFor="otp" className={LABEL}>Enter OTP</label>
              <input
                id="otp"
                type="text" inputMode="numeric" placeholder="6-digit code" value={otp} autoFocus
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && verify()}
                className={`${INPUT} tracking-[0.3em]`}
              />
            </div>
          </>
        )}
        {error && (
          <p className="flex items-center gap-1.5 text-[12px] text-[#B91C1C]">
            <AlertCircle size={12} /> {error}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className={`cursor-pointer ${BTN_SECONDARY} flex-1`}>Cancel</button>
          <button onClick={stage === 'request' ? requestOtp : verify} disabled={busy || stage === 'request'} className={`cursor-pointer ${BTN_PRIMARY} flex-1`}>
            {busy && <Loader2 size={14} className="animate-spin" />}
            Verify
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/** Header/body cell — thin wrappers over the shared `TH`/`TD` tokens so callers can add layout classes. */
function TH_CELL({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`${TH} ${className}`}>{children}</th>;
}
function TD_CELL({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`${TD} ${className}`}>{children}</td>;
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

function VideoCard({ video: v, tint, isPlaying, onPlay, onToggleVisibility }: {
  video: VideoItem;
  tint: string;
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
    <div className={`${CARD} overflow-hidden`}>

      {/* Video player / thumbnail */}
      <div className="relative aspect-video bg-[#0E1726]">
        {isPlaying ? (
          <video src={v.videoUrl} controls autoPlay className="h-full w-full object-contain" onEnded={onPlay} />
        ) : (
          <button
            onClick={onPlay}
            aria-label={`Play video by ${v.studentName}`}
            className="cursor-pointer group relative flex h-full w-full items-center justify-center"
          >
            {v.thumbnailUrl ? (
              <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#0E2A5C]">
                <Video className="h-8 w-8 text-white/25" />
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/15">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md">
                <span className="ml-0.5 h-0 w-0 border-b-[7px] border-l-[12px] border-t-[7px] border-b-transparent border-l-[#1559C7] border-t-transparent" />
              </span>
            </span>
          </button>
        )}

        {v.isEvaluation && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#111827]/85 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur-sm">
            <Star className="h-2.5 w-2.5 fill-current" /> Olympiad
          </span>
        )}
        {v.uploaderType === 'SCHOOL' && (
          <span className="absolute right-2 top-2 rounded-md bg-[#111827]/85 px-2 py-1 text-[10.5px] font-semibold text-white backdrop-blur-sm">
            By school
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="space-y-2 p-3">

        <div className="flex items-center gap-2">
          <Avatar name={v.studentName} tint={tint} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-[#111827]">{v.studentName}</p>
            <p className="truncate font-mono text-[11px] font-medium text-[#1559C7]">{v.olympiadCode}</p>
          </div>
          {v.className && (
            <span className="flex flex-shrink-0 items-center gap-1 rounded-md bg-[#EDF0F4] px-1.5 py-0.5 text-[11px] font-medium text-[#4B5563]">
              <BookOpen className="h-2.5 w-2.5" />{v.className}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone="neutral">{getCategoryDisplayLabel(v.category)}</StatusBadge>
          {v.subCategory && <StatusBadge tone="neutral">{v.subCategory}</StatusBadge>}
          {v.isEvaluation && (
            <button
              onClick={onToggleVisibility}
              title={isPrivate ? 'Private — click to make public' : 'Public — click to make private'}
              className={`cursor-pointer ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${FOCUS} ${
                isPrivate
                  ? 'bg-[#4B5563]/10 text-[#4B5563] hover:bg-[#4B5563]/20'
                  : 'bg-[#047857]/10 text-[#047857] hover:bg-[#047857]/20'
              }`}
            >
              {isPrivate ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
              {isPrivate ? 'Private' : 'Public'}
            </button>
          )}
        </div>

        {v.caption && (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-[#4B5563]">{v.caption}</p>
        )}

        {v.tags && (
          <div className="flex flex-wrap items-center gap-1">
            <Tag className="h-2.5 w-2.5 flex-shrink-0 text-[#9CA3AF]" />
            {v.tags.split(',').slice(0, 4).map(tag => (
              <span key={tag} className="text-[11px] text-[#6B7280]">#{tag.trim()}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#F1F3F6] pt-2 text-[11.5px] text-[#6B7280]">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{v.likesCount}</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{v.viewsCount}</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(v.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </span>
          </div>
          <button
            onClick={handleShare}
            title={copied ? 'Link copied' : 'Share'}
            className={`cursor-pointer inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors ${FOCUS} ${
              copied ? 'bg-[#047857]/10 text-[#047857]' : 'text-[#4B5563] hover:bg-[#F6F7F9]'
            }`}
          >
            {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
            {copied ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
