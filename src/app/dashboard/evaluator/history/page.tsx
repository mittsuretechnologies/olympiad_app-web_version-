'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Star, Loader2, Calendar, Pencil, Lock, Unlock, ChevronDown, ChevronUp, User, School } from 'lucide-react';

interface VideoRecord {
  id: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  category: string;
  subCategory: string;
  confidenceScore: number;
  creativityScore: number;
  techniqueScore: number;
  presentationScore: number;
  totalScore: number;
  remarks: string | null;
  createdAt: string;
  isPublished: boolean;
  publishedAt: string | null;
  evaluatorName: string;
  evaluatorId: string;
}

interface StudentHistory {
  studentKey: string;
  studentName: string;
  username: string | null;
  olympiadCode: string;
  className: string | null;
  schoolName: string | null;
  videos: VideoRecord[];
  videoCount: number;
  combinedScore: number;
  combinedMaxScore: number;
  allPublished: boolean;
}

const CRITERIA = [
  { key: 'confidenceScore',   label: 'Confidence & Stage Presence' },
  { key: 'creativityScore',   label: 'Creativity & Originality' },
  { key: 'techniqueScore',    label: 'Technique & Skill' },
  { key: 'presentationScore', label: 'Presentation & Overall Impact' },
] as const;

function getAuthToken() {
  if (typeof window === 'undefined') return '';
  return (
    sessionStorage.getItem('evaluatorToken') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('reviewerToken') ||
    ''
  );
}

function scoreBandClass(score: number, max: number) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 80) return 'bg-green-50 text-green-700 border-green-200';
  if (pct >= 55) return 'bg-blue-50 text-[#004f9f] border-blue-200';
  if (pct >= 30) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-600 border-red-200';
}

const CARD_PALETTE = [
  { bg: 'bg-blue-50/70',   avatar: 'from-blue-500 to-indigo-600' },
  { bg: 'bg-rose-50/70',   avatar: 'from-rose-500 to-pink-600' },
  { bg: 'bg-amber-50/70',  avatar: 'from-amber-500 to-orange-600' },
  { bg: 'bg-emerald-50/70', avatar: 'from-emerald-500 to-teal-600' },
  { bg: 'bg-violet-50/70', avatar: 'from-violet-500 to-purple-600' },
  { bg: 'bg-cyan-50/70',   avatar: 'from-cyan-500 to-sky-600' },
];

function cardTheme(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return CARD_PALETTE[hash % CARD_PALETTE.length];
}

export default function EvaluationHistoryPage() {
  const [students, setStudents] = useState<StudentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentEvaluatorId, setCurrentEvaluatorId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  useEffect(() => {
    setIsSuperAdmin(!!sessionStorage.getItem('token'));
    try {
      const evaluatorData = sessionStorage.getItem('evaluatorData');
      if (evaluatorData) setCurrentEvaluatorId(JSON.parse(evaluatorData).id);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch('/api/evaluator/me/evaluation-history', {
      headers: { Authorization: `Bearer ${getAuthToken()}` }
    })
      .then(async r => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to load evaluation history');
        }
        return r.json();
      })
      .then(setStudents)
      .catch(e => setError(e.message || 'Failed to load evaluation history'))
      .finally(() => setLoading(false));
  }, []);

  const togglePublish = async (video: VideoRecord) => {
    setPublishing(video.videoId);
    try {
      const res = await fetch('/api/evaluator/me/evaluate/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ videoId: video.videoId, publish: !video.isPublished }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update publish status');
      setStudents(prev => prev.map(s => {
        if (!s.videos.some(v => v.videoId === video.videoId)) return s;
        const videos = s.videos.map(v => v.videoId === video.videoId ? { ...v, isPublished: data.isPublished, publishedAt: data.publishedAt } : v);
        return { ...s, videos, allPublished: videos.every(v => v.isPublished) };
      }));
    } catch (e: any) {
      alert(e.message || 'Failed to update publish status');
    } finally {
      setPublishing(null);
    }
  };

  const categories = useMemo(() => {
    const set = new Set(students.flatMap(s => s.videos.map(v => v.category)).filter(Boolean));
    return Array.from(set);
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchesSearch =
        s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        (s.username || '').toLowerCase().includes(search.toLowerCase()) ||
        s.olympiadCode.toLowerCase().includes(search.toLowerCase()) ||
        (s.schoolName || '').toLowerCase().includes(search.toLowerCase());

      const matchesCategory = !categoryFilter || s.videos.some(v => v.category === categoryFilter);

      let matchesStatus = true;
      if (statusFilter === 'published') matchesStatus = s.allPublished;
      else if (statusFilter === 'draft') matchesStatus = !s.allPublished;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [students, search, categoryFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">Evaluation History</h1>
        <p className="text-sm text-gray-400 mt-1">Combined report per student — all evaluated videos in one card.</p>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search student, code, school..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#004f9f] focus:ring-2 focus:ring-[#004f9f]/10"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none focus:border-[#004f9f]"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none focus:border-[#004f9f]"
          >
            <option value="">All Status</option>
            <option value="published">Fully Published</option>
            <option value="draft">Has Draft</option>
          </select>
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="py-20 flex justify-center flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#004f9f]" />
          <p className="text-xs text-gray-400">Loading history...</p>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500 text-sm bg-white border border-gray-100 rounded-2xl shadow-sm">
          {error}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="py-20 text-center text-gray-400 text-sm bg-white border border-gray-100 rounded-2xl shadow-sm">
          {students.length === 0 ? 'No evaluated submissions yet.' : 'No matching history records found.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredStudents.map(s => {
            const isOpen = expanded === s.studentKey;
            const theme = cardTheme(s.studentKey);
            return (
              <div key={s.studentKey} className={`border rounded-2xl overflow-hidden transition-all duration-200 ${
                isOpen ? 'border-[#004f9f]/25 shadow-md' : 'border-gray-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-gray-300 hover:shadow-md'
              }`}>
                {/* Card header — always visible */}
                <button
                  onClick={() => setExpanded(isOpen ? null : s.studentKey)}
                  className={`w-full flex items-center justify-between gap-4 px-5 py-4 transition-colors text-left ${theme.bg} hover:brightness-95`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${theme.avatar} text-white text-sm font-bold flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-black/5`}>
                      {s.studentName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[15px] text-gray-900 truncate tracking-tight">{s.studentName}</p>
                      <div className="flex items-center gap-2 text-[11.5px] text-gray-500 mt-0.5">
                        <span className="font-mono font-semibold text-[#004f9f] bg-[#004f9f]/[0.06] px-1.5 py-0.5 rounded-md">{s.olympiadCode}</span>
                        {s.schoolName && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="flex items-center gap-1 truncate text-gray-500"><School size={11} className="text-gray-400 flex-shrink-0" /> {s.schoolName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide border ${
                      s.allPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>
                      {s.allPublished ? <Lock size={10} /> : <Unlock size={10} />}
                      {s.allPublished ? 'Published' : 'Draft'}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${scoreBandClass(s.combinedScore, s.combinedMaxScore)}`}>
                      <Star size={11} className="fill-current" />
                      {s.combinedScore}<span className="opacity-60 font-semibold">/{s.combinedMaxScore}</span>
                    </span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isOpen ? 'bg-[#004f9f]/10' : 'bg-gray-50'}`}>
                      {isOpen ? <ChevronUp size={14} className="text-[#004f9f]" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </div>
                </button>

                {/* Expanded detail — both videos */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/40 p-5 space-y-4">
                    {s.videos.map((v, vi) => (
                      <div key={v.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
                          {/* Video */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <User size={13} className="text-gray-400" />
                              <span className="text-xs font-bold text-gray-700">Video {vi + 1}</span>
                              {v.category && <span className="text-[10px] font-semibold bg-blue-50 text-[#004f9f] px-2 py-0.5 rounded-full">{v.category}</span>}
                              {v.subCategory && <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{v.subCategory}</span>}
                            </div>
                            <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                              <video src={v.videoUrl} controls className="w-full max-h-56 object-contain" />
                            </div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                              <Calendar size={12} /> Evaluated {new Date(v.createdAt).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })} · by {v.evaluatorName}
                            </div>
                          </div>

                          {/* Score breakdown */}
                          <div className="space-y-4">
                            <div className="space-y-2.5">
                              {CRITERIA.map(c => {
                                const score = v[c.key];
                                const pct = (score / 5) * 100;
                                return (
                                  <div key={c.key} className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700">
                                      <span>{c.label}</span>
                                      <span className="font-bold text-[#004f9f]">{score}/5</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-[#004f9f] rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex items-center justify-between bg-[#F6F9FF] rounded-xl px-3 py-2 border border-blue-50">
                              <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                                <Star className="w-3.5 h-3.5 text-[#FF9000] fill-current" /> Total
                              </span>
                              <span className="text-base font-black text-[#004f9f]">{v.totalScore}/20</span>
                            </div>

                            {v.remarks && (
                              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 italic">
                                {v.remarks}
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                                v.isPublished ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}>
                                {v.isPublished ? <Lock size={10} /> : <Unlock size={10} />}
                                {v.isPublished ? 'Published' : 'Draft'}
                              </span>
                            </div>

                            {(() => {
                              const isOwner = currentEvaluatorId === v.evaluatorId;
                              const showReEvaluateBtn = !v.isPublished && (isSuperAdmin || isOwner);
                              const showPublishBtn = isSuperAdmin || (isOwner && !v.isPublished);
                              if (!showReEvaluateBtn && !showPublishBtn) return null;
                              return (
                                <div className="flex gap-2">
                                  {showReEvaluateBtn && (
                                    <Link
                                      href={`/dashboard/evaluator/evaluate-content?videoId=${v.videoId}`}
                                      className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 text-white py-2 rounded-lg font-bold text-xs hover:bg-amber-600 transition-colors"
                                    >
                                      <Pencil size={12} /> Re-evaluate
                                    </Link>
                                  )}
                                  {showPublishBtn && (
                                    <button
                                      onClick={() => togglePublish(v)}
                                      disabled={publishing === v.videoId}
                                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs transition-colors disabled:opacity-50 ${
                                        v.isPublished ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-green-600 text-white hover:bg-green-700'
                                      }`}
                                    >
                                      {v.isPublished ? <Unlock size={12} /> : <Lock size={12} />}
                                      {publishing === v.videoId ? 'Working...' : v.isPublished ? 'Unpublish' : 'Publish'}
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
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
