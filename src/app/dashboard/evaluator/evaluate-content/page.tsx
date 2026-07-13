'use client';

import { useEffect, useState } from 'react';
import { Video as VideoIcon, User, School, CheckCircle, X, Star, Loader2, LayoutGrid } from 'lucide-react';
import { KOSH_LABELS, type KoshKey } from '@/lib/kosh';

interface ExistingScore {
  confidenceScore: number;
  creativityScore: number;
  techniqueScore: number;
  presentationScore: number;
  remarks: string | null;
}

interface QueueVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string;
  category: string;
  subCategory: string;
  createdAt: string;
  studentName: string;
  olympiadCode: string;
  className: string | null;
  schoolName: string | null;
  slot: number;
  koshes: [KoshKey, KoshKey];
  existingScore: ExistingScore | null;
  isFullyScored?: boolean;
  isFullyPublished?: boolean;
}

const MAX_PER_CRITERION = 5;

const CRITERIA = [
  { key: 'confidenceScore',   label: 'Confidence & Stage Presence' },
  { key: 'creativityScore',   label: 'Creativity & Originality' },
  { key: 'techniqueScore',    label: 'Technique & Skill' },
  { key: 'presentationScore', label: 'Presentation & Overall Impact' },
] as const;

type ScoreState = Record<typeof CRITERIA[number]['key'], number>;

const emptyScores: ScoreState = {
  confidenceScore: 0,
  creativityScore: 0,
  techniqueScore: 0,
  presentationScore: 0,
};

function scoreTotal(s: ScoreState) {
  return Object.values(s).reduce((a, b) => a + b, 0);
}

function scorePercent(total: number) {
  return Math.round((total / 20) * 1000) / 10;
}

// This page is used both by real evaluators and by SuperAdmin/Reviewer
// (read-only oversight), so send whichever session token is present —
// same role-detection order as dashboard/layout.tsx.
function getAuthToken() {
  if (typeof window === 'undefined') return '';
  return (
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('reviewerToken') ||
    sessionStorage.getItem('evaluatorToken') ||
    ''
  );
}

export default function EvaluateContentPage() {
  const [queue, setQueue] = useState<QueueVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<QueueVideo | null>(null);
  const [scores, setScores] = useState<ScoreState>(emptyScores);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [columns, setColumns] = useState(3);
  const [activeColor, setActiveColor] = useState('bg-blue-50');

  // Both TalentEvaluator and SuperAdmin accounts can submit scores.
  const [canScore, setCanScore] = useState(false);
  useEffect(() => {
    setCanScore(!!sessionStorage.getItem('evaluatorToken') || !!sessionStorage.getItem('token'));
  }, []);

  const fetchQueue = () => {
    setLoading(true);
    setLoadError('');
    const query = typeof window !== 'undefined' ? window.location.search : '';
    fetch(`/api/evaluator/me/evaluation-queue${query}`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      .then(async r => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.message || 'Failed to load evaluation queue');
        }
        return r.json();
      })
      .then(setQueue)
      .catch(e => setLoadError(e.message || 'Failed to load evaluation queue'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchQueue(); }, []);

  useEffect(() => {
    if (queue.length > 0 && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('videoId');
      if (targetId) {
        const found = queue.find(v => v.id === targetId);
        if (found) {
          openVideo(found, 'bg-blue-50');
        }
      }
    }
  }, [queue]);

  const openVideo = (v: QueueVideo, color: string) => {
    setActive(v);
    setActiveColor(color);
    if (v.existingScore) {
      setScores({
        confidenceScore: v.existingScore.confidenceScore,
        creativityScore: v.existingScore.creativityScore,
        techniqueScore: v.existingScore.techniqueScore,
        presentationScore: v.existingScore.presentationScore,
      });
      setRemarks(v.existingScore.remarks || '');
    } else {
      setScores(emptyScores);
      setRemarks('');
    }
    setError('');
  };

  const total = scoreTotal(scores);
  const percent = scorePercent(total);

  const handleSubmit = async () => {
    if (!active) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/evaluator/me/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ videoId: active.id, ...scores, remarks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit');
      setQueue(prev => prev.filter(v => v.id !== active.id));
      setActive(null);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const CARD_COLORS = ['bg-blue-50', 'bg-rose-50', 'bg-amber-50', 'bg-emerald-50', 'bg-violet-50', 'bg-cyan-50'];
  const HEADER_COLORS: Record<string, string> = {
    'bg-blue-50': 'bg-blue-100',
    'bg-rose-50': 'bg-rose-100',
    'bg-amber-50': 'bg-amber-100',
    'bg-emerald-50': 'bg-emerald-100',
    'bg-violet-50': 'bg-violet-100',
    'bg-cyan-50': 'bg-cyan-100',
  };

  const GRID_COLS_CLASS: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-6',
    7: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-7',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Evaluate Content</h1>
          <p className="text-sm text-gray-400 mt-1">Score each video out of 20 (4 criteria × 5 marks).</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1">
          <LayoutGrid size={14} className="text-gray-400 ml-1.5" />
          {[2, 3, 4, 5, 6, 7].map(n => (
            <button
              key={n}
              onClick={() => setColumns(n)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                columns === n ? 'bg-[#004f9f] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={`grid ${GRID_COLS_CLASS[columns]} gap-4`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-100 rounded-2xl shadow-sm p-12 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
            <X size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Couldn't load the queue</h2>
          <p className="text-sm text-gray-400 max-w-sm">{loadError}</p>
        </div>
      ) : queue.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-12 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center">
            <CheckCircle size={28} className="text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">All caught up!</h2>
          <p className="text-sm text-gray-400 max-w-sm">No olympiad videos pending evaluation right now.</p>
        </div>
      ) : (
        <div className={`grid ${GRID_COLS_CLASS[columns]} gap-4`}>
          {queue.map((v, i) => (
            <button key={v.id} onClick={() => openVideo(v, CARD_COLORS[i % CARD_COLORS.length])}
              className="border border-gray-100 rounded-2xl shadow-sm overflow-hidden text-left hover:shadow-md hover:border-[#004f9f]/20 transition-all group">
              <div className="relative aspect-video bg-gray-900 flex items-center justify-center overflow-hidden">
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <VideoIcon className="w-8 h-8 text-white/40" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
              <div className={`p-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#004f9f] uppercase tracking-wide truncate">{v.category}</p>
                  <span className="text-[10px] font-bold bg-white/70 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">Video {v.slot + 1}</span>
                </div>
                <p className="text-sm text-gray-700 font-semibold truncate mt-0.5">{v.subCategory}</p>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                  <User className="w-3 h-3" /> {v.studentName} · {v.olympiadCode}
                </div>
                {v.schoolName && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400 truncate">
                    <School className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{v.schoolName}</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Evaluation modal */}
      {active && (
        <div className="fixed inset-0 left-72 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !submitting && setActive(null)}>
          <div className={`rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto ${activeColor}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 z-10 ${HEADER_COLORS[activeColor] || activeColor}`}>
              <div>
                <h2 className="text-base font-bold text-gray-800">{active.studentName} — {active.olympiadCode}</h2>
                <p className="text-xs text-gray-400">{active.category} · {active.subCategory} · Video {active.slot + 1}</p>
              </div>
              <button onClick={() => setActive(null)} className="text-gray-300 hover:text-gray-500 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              {/* Video */}
              <div>
                <div className="rounded-xl overflow-hidden bg-black">
                  <video src={active.videoUrl} controls className="w-full max-h-80 object-contain" />
                </div>
                {active.caption && <p className="text-sm text-gray-500 mt-3">{active.caption}</p>}

                {/* This video's % is split evenly across its two koshas */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {active.koshes.map(k => (
                    <span key={k} className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#F6F9FF] text-[#004f9f] pl-2.5 pr-1 py-1 rounded-full border border-blue-100">
                      {KOSH_LABELS[k]}
                      <span className="bg-[#004f9f] text-white px-1.5 py-0.5 rounded-full">{Math.round((percent / 2) * 10) / 10}%</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Scoring */}
              <div className="space-y-4">
                {!canScore && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-xl px-3 py-2">
                    View-only — sign in with an evaluator account to score this submission.
                  </div>
                )}
                {active.isFullyPublished && (
                  <div className="bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-xl px-3 py-2">
                    This evaluation is published and locked. Unpublish it from Evaluation History to make changes.
                  </div>
                )}
                <fieldset disabled={!canScore || active.isFullyPublished} className="space-y-4 disabled:opacity-60">
                  {CRITERIA.map(c => (
                    <div key={c.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-semibold text-gray-700">{c.label}</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min={0} max={MAX_PER_CRITERION} step={1}
                            value={scores[c.key]}
                            onChange={e => {
                              const v = Math.min(MAX_PER_CRITERION, Math.max(0, Number(e.target.value) || 0));
                              setScores(prev => ({ ...prev, [c.key]: v }));
                            }}
                            className="w-16 h-9 border border-gray-300 rounded-lg text-base font-bold text-center text-[#004f9f] outline-none focus:border-[#06013E]/40"
                          />
                          <span className="text-sm font-bold text-[#004f9f]">/{MAX_PER_CRITERION}</span>
                        </div>
                      </div>
                      <input
                        type="range" min={0} max={MAX_PER_CRITERION} step={1}
                        value={scores[c.key]}
                        onChange={e => setScores(prev => ({ ...prev, [c.key]: Number(e.target.value) }))}
                        className="w-full accent-[#06013E]"
                      />
                    </div>
                  ))}

                  <div className="flex items-center justify-between bg-[#F6F9FF] rounded-xl px-4 py-3">
                    <span className="text-sm font-bold text-gray-600 flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-[#FF9000]" /> Total Score
                    </span>
                    <span className="text-lg font-black text-[#06013E]">{total}/20 <span className="text-sm font-bold text-gray-400">({percent}%)</span></span>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Remarks (optional)</label>
                    <textarea
                      value={remarks} onChange={e => setRemarks(e.target.value)}
                      rows={2}
                      placeholder="Any notes for this submission..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder-gray-300 outline-none focus:border-[#06013E]/40 resize-none"
                    />
                  </div>
                </fieldset>

                {error && <p className="text-sm text-red-500">{error}</p>}

                {canScore && !active.isFullyPublished && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full bg-[#06013E] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#0a0258] transition-colors disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {submitting ? 'Submitting...' : 'Submit Evaluation'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
