'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Video, Star, Eye, Heart, BookOpen, Search,
  Filter, Award, Clapperboard, Calendar, Tag
} from 'lucide-react';

interface VideoItem {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string;
  category: string;
  subCategory: string;
  tags: string;
  isEvaluation: boolean;
  uploaderType: string;
  status: string;
  likesCount: number;
  viewsCount: number;
  createdAt: string;
  studentName: string;
  studentId: string | null;
  olympiadCode: string;
  classCode: string | null;
  className: string | null;
  source: 'web' | 'app';
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
];

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function StudentVideosPage() {
  const [videos, setVideos]     = useState<VideoItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'OLYMPIAD' | 'GENERAL'>('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [playing, setPlaying]   = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('schoolToken') || '' : '';

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
          !v.olympiadCode.toLowerCase().includes(q) &&
          !v.category.toLowerCase().includes(q) &&
          !v.subCategory.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [videos, typeFilter, classFilter, search]);

  const olympiadCount = videos.filter(v => v.isEvaluation).length;
  const generalCount  = videos.filter(v => !v.isEvaluation).length;

  return (
    <div className="space-y-5">

      {/* Stats header */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#06013E]/10 flex items-center justify-center flex-shrink-0">
            <Video className="w-5 h-5 text-[#06013E]" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#06013E]">{videos.length}</p>
            <p className="text-xs text-gray-400">Total in Feed</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Award className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-amber-600">{olympiadCount}</p>
            <p className="text-xs text-gray-400">Olympiad Entries</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Clapperboard className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-blue-600">{generalCount}</p>
            <p className="text-xs text-gray-400">General Feed</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
          <input
            type="text"
            placeholder="Search student, ID, category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-[#06013E]/40"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['ALL', 'OLYMPIAD', 'GENERAL'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                typeFilter === t
                  ? t === 'OLYMPIAD' ? 'bg-amber-500 text-white' : t === 'GENERAL' ? 'bg-blue-500 text-white' : 'bg-white text-[#06013E] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'ALL' ? 'All Videos' : t === 'OLYMPIAD' ? '⭐ Olympiad' : '🎬 General'}
            </button>
          ))}
        </div>

        {/* Class filter */}
        {classes.length > 0 && (
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#06013E]/40 text-gray-600"
            >
              <option value="ALL">All Classes</option>
              {classes.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        )}

        <span className="ml-auto text-xs text-gray-400">{filtered.length} video{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-24 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#06013E] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading videos...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-100 py-16 text-center text-red-500 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-24 text-center">
          <Video className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {videos.length === 0 ? 'No approved videos from your students yet.' : 'No videos match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(v => (
            <VideoCard
              key={v.id}
              video={v}
              isPlaying={playing === v.id}
              onPlay={() => setPlaying(playing === v.id ? null : v.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoCard({ video: v, isPlaying, onPlay }: { video: VideoItem; isPlaying: boolean; onPlay: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">

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
              <div className="w-full h-full bg-gradient-to-br from-[#06013E] to-[#1a0f6e] flex items-center justify-center">
                <Video className="w-10 h-10 text-white/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-[#06013E] ml-1" />
              </div>
            </div>
          </button>
        )}

        {/* Olympiad badge — top left */}
        {v.isEvaluation && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-400 text-[#06013E] px-2 py-0.5 rounded-full text-[10px] font-black shadow">
            <Star className="w-2.5 h-2.5 fill-current" />
            OLYMPIAD
          </div>
        )}

        {/* Uploader type — top right */}
        {v.uploaderType === 'SCHOOL' && (
          <div className="absolute top-2 right-2 bg-[#06013E]/80 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
            By School
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">

        {/* Student info */}
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-full ${avatarColor(v.studentName)} text-white text-[11px] font-black flex items-center justify-center flex-shrink-0`}>
            {getInitials(v.studentName)}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[#06013E] text-sm truncate">{v.studentName}</p>
            <p className="text-[10px] text-gray-400 font-mono">{v.olympiadCode}</p>
          </div>
          {v.className && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-[#E8EAF6] text-[#06013E] rounded-full flex-shrink-0">
              <BookOpen className="w-2.5 h-2.5" />{v.className}
            </span>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{v.category}</span>
          {v.subCategory && (
            <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{v.subCategory}</span>
          )}
        </div>

        {/* Caption */}
        {v.caption && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{v.caption}</p>
        )}

        {/* Tags */}
        {v.tags && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="w-3 h-3 text-gray-300 flex-shrink-0" />
            {v.tags.split(',').slice(0, 4).map(tag => (
              <span key={tag} className="text-[10px] text-blue-500 font-medium">#{tag.trim()}</span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{v.likesCount}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{v.viewsCount}</span>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <Calendar className="w-3 h-3" />
            {new Date(v.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
}
