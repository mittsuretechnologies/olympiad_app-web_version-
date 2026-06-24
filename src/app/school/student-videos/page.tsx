'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Video, Star, Eye, Heart, BookOpen, Search,
  Filter, Calendar, Tag, Loader2
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
    <div className="space-y-3">

      {/* Title bar */}
      <div className="bg-white border border-gray-300">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-300 bg-[#F4F5F7]">
          <div className="flex items-center gap-2">
            <Video size={15} className="text-[#06013E]" />
            <h1 className="text-[13px] font-bold text-[#06013E] uppercase tracking-wide">Student Video Submissions</h1>
          </div>
          <span className="text-[11px] text-gray-500">{filtered.length} video{filtered.length !== 1 ? 's' : ''} shown</span>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-gray-200">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-gray-600 font-medium">Total in Feed</span>
            <span className="text-sm font-bold text-[#06013E] font-mono">{videos.length}</span>
          </div>
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-gray-600 font-medium">Olympiad Entries</span>
            <span className="text-sm font-bold text-amber-700 font-mono">{olympiadCount}</span>
          </div>
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-gray-600 font-medium">General Feed</span>
            <span className="text-sm font-bold text-blue-700 font-mono">{generalCount}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-300 px-4 py-2.5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
          <input
            type="text"
            placeholder="Search student, ID, category"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 border border-gray-300 text-[12px] focus:outline-none focus:border-[#06013E]"
          />
        </div>

        <div className="flex items-center border border-gray-300 divide-x divide-gray-300">
          {(['ALL', 'OLYMPIAD', 'GENERAL'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                typeFilter === t ? 'bg-[#06013E] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
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
              className="text-[12px] border border-gray-300 px-2 py-1.5 outline-none focus:border-[#06013E] text-gray-700 bg-white"
            >
              <option value="ALL">All Classes</option>
              {classes.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white border border-gray-300 py-20 flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#06013E]" />
          <p className="text-sm text-gray-500">Loading videos...</p>
        </div>
      ) : error ? (
        <div className="bg-white border border-red-300 py-16 text-center text-red-700 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-300 py-20 text-center text-gray-500 text-sm">
          {videos.length === 0 ? 'No approved videos from your students yet.' : 'No videos match your filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
    <div className="bg-white border border-gray-300 overflow-hidden">

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
              <div className="w-full h-full bg-[#06013E] flex items-center justify-center">
                <Video className="w-10 h-10 text-white/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <div className="w-12 h-12 border border-white bg-white/90 flex items-center justify-center shadow-lg">
                <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-[#06013E] ml-1" />
              </div>
            </div>
          </button>
        )}

        {/* Olympiad badge — top left */}
        {v.isEvaluation && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold">
            <Star className="w-2.5 h-2.5 fill-current" />
            OLYMPIAD
          </div>
        )}

        {/* Uploader type — top right */}
        {v.uploaderType === 'SCHOOL' && (
          <div className="absolute top-2 right-2 bg-[#06013E] text-white px-2 py-0.5 text-[10px] font-bold">
            By School
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3.5 space-y-2.5">

        {/* Student info */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 border border-gray-300 bg-[#F4F5F7] text-[#06013E] text-[11px] font-bold flex items-center justify-center flex-shrink-0">
            {getInitials(v.studentName)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{v.studentName}</p>
            <p className="text-[10px] text-gray-500 font-mono">{v.olympiadCode}</p>
          </div>
          {v.className && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 border border-gray-300 text-gray-700 flex-shrink-0">
              <BookOpen className="w-2.5 h-2.5" />{v.className}
            </span>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 border border-gray-300 text-gray-600">{v.category}</span>
          {v.subCategory && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 border border-gray-300 text-gray-600">{v.subCategory}</span>
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
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{v.likesCount}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{v.viewsCount}</span>
          </div>
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <Calendar className="w-3 h-3" />
            {new Date(v.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
}
