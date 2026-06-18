'use client';

import { useEffect, useState } from 'react';
import { Video as VideoIcon, User, School, CheckCircle, X, Star, Loader2 } from 'lucide-react';

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
}

const CRITERIA = [
  { key: 'confidenceScore',   label: 'Confidence & Stage Presence' },
  { key: 'creativityScore',   label: 'Creativity & Originality' },
  { key: 'techniqueScore',    label: 'Technique & Skill' },
  { key: 'presentationScore', label: 'Presentation & Clarity' },
  { key: 'overallScore',      label: 'Overall Impact' },
] as const;

type ScoreState = Record<typeof CRITERIA[number]['key'], number>;

const emptyScores: ScoreState = {
  confidenceScore: 0,
  creativityScore: 0,
  techniqueScore: 0,
  presentationScore: 0,
  overallScore: 0,
};

function getEvaluatorToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('evaluatorToken') || '' : '';
}

export default function EvaluateContentPage() {
  const [queue, setQueue] = useState<QueueVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<QueueVideo | null>(null);
  const [scores, setScores] = useState<ScoreState>(emptyScores);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchQueue = () => {
    setLoading(true);
    fetch('/api/evaluator/me/evaluation-queue', { headers: { Authorization: `Bearer ${getEvaluatorToken()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setQueue)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchQueue(); }, []);

  const openVideo = (v: QueueVideo) => {
    setActive(v);
    setScores(emptyScores);
    setRemarks('');
    setError('');
  };

  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  const handleSubmit = async () => {
    if (!active) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/evaluator/me/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getEvaluatorToken()}` },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">Evaluate Content</h1>
        <p className="text-sm text-gray-400 mt-1">Score olympiad participation videos out of 100 (5 criteria × 20 marks).</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {queue.map(v => (
            <button key={v.id} onClick={() => openVideo(v)}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden text-left hover:shadow-md hover:border-[#004f9f]/20 transition-all group">
              <div className="relative aspect-video bg-gray-900 flex items-center justify-center overflow-hidden">
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <VideoIcon className="w-8 h-8 text-white/40" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </div>
              <div className="p-4">
                <p className="text-xs font-bold text-[#004f9f] uppercase tracking-wide truncate">{v.category}</p>
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !submitting && setActive(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-bold text-gray-800">{active.studentName} — {active.olympiadCode}</h2>
                <p className="text-xs text-gray-400">{active.category} · {active.subCategory}</p>
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
              </div>

              {/* Scoring */}
              <div className="space-y-4">
                {CRITERIA.map(c => (
                  <div key={c.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-semibold text-gray-700">{c.label}</label>
                      <span className="text-sm font-bold text-[#004f9f]">{scores[c.key]}/20</span>
                    </div>
                    <input
                      type="range" min={0} max={20} step={1}
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
                  <span className="text-lg font-black text-[#06013E]">{total}/100</span>
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

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full bg-[#06013E] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#0a0258] transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {submitting ? 'Submitting...' : 'Submit Evaluation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
