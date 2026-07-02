'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Video as VideoIcon, Search, Eye, X, Star, Loader2, Calendar, Pencil } from 'lucide-react';

interface EvaluationRecord {
  id: string;
  videoId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  category: string;
  subCategory: string;
  studentName: string;
  olympiadCode: string;
  confidenceScore: number;
  creativityScore: number;
  techniqueScore: number;
  presentationScore: number;
  totalScore: number;
  remarks: string | null;
  createdAt: string;
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
    localStorage.getItem('evaluatorToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('reviewerToken') ||
    ''
  );
}

export default function EvaluationHistoryPage() {
  const [records, setRecords] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [scoreFilter, setScoreFilter] = useState('');
  const [active, setActive] = useState<EvaluationRecord | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    setIsSuperAdmin(!!localStorage.getItem('token'));
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
      .then(setRecords)
      .catch(e => setError(e.message || 'Failed to load evaluation history'))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const set = new Set(records.map(r => r.category).filter(Boolean));
    return Array.from(set);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Search matches
      const matchesSearch =
        r.studentName.toLowerCase().includes(search.toLowerCase()) ||
        r.olympiadCode.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase()) ||
        r.subCategory.toLowerCase().includes(search.toLowerCase());

      // Category matches
      const matchesCategory = !categoryFilter || r.category === categoryFilter;

      // Score matches
      let matchesScore = true;
      if (scoreFilter === 'excellent') matchesScore = r.totalScore >= 16;
      else if (scoreFilter === 'good') matchesScore = r.totalScore >= 11 && r.totalScore <= 15;
      else if (scoreFilter === 'average') matchesScore = r.totalScore >= 6 && r.totalScore <= 10;
      else if (scoreFilter === 'poor') matchesScore = r.totalScore <= 5;

      return matchesSearch && matchesCategory && matchesScore;
    });
  }, [records, search, categoryFilter, scoreFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">Evaluation History</h1>
        <p className="text-sm text-gray-400 mt-1">Review all your previously evaluated video submissions.</p>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search student, code, category..."
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
            value={scoreFilter}
            onChange={e => setScoreFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none focus:border-[#004f9f]"
          >
            <option value="">All Scores</option>
            <option value="excellent">Excellent (16-20)</option>
            <option value="good">Good (11-15)</option>
            <option value="average">Average (6-10)</option>
            <option value="poor">Poor (0-5)</option>
          </select>
        </div>
      </div>

      {/* Main Content Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#004f9f]" />
            <p className="text-xs text-gray-400">Loading your history...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 text-sm">
            {error}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            {records.length === 0 ? 'You have not evaluated any submissions yet.' : 'No matching history records found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-400">
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Student Details</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Category / Topic</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Evaluation Date</th>
                  <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-wider">Total Score</th>
                  <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-400 text-xs font-semibold">{i + 1}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{r.studentName}</div>
                      <div className="text-[11px] font-mono text-[#004f9f] font-bold">{r.olympiadCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-700">{r.category}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{r.subCategory}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-gray-400" />
                        {new Date(r.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border ${
                        r.totalScore >= 16 ? 'bg-green-50 text-green-700 border-green-200' :
                        r.totalScore >= 11 ? 'bg-blue-50 text-[#004f9f] border-blue-200' :
                        r.totalScore >= 6 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-600 border-red-200'
                      }`}>
                        <Star size={11} className={r.totalScore >= 11 ? 'fill-current' : ''} />
                        {r.totalScore}/20
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setActive(r)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#004f9f]/5 text-[#004f9f] rounded-lg hover:bg-[#004f9f]/10 transition-colors"
                      >
                        <Eye size={12} /> View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details View Modal */}
      {active && (
        <div className="fixed inset-0 left-72 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setActive(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-10">
              <div>
                <h2 className="text-base font-bold text-gray-800">{active.studentName} — {active.olympiadCode}</h2>
                <p className="text-xs text-gray-400">{active.category} · {active.subCategory}</p>
              </div>
              <button onClick={() => setActive(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              {/* Left Column: Video */}
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                  <video src={active.videoUrl} controls className="w-full max-h-80 object-contain" />
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Calendar size={13} /> Evaluated on {new Date(active.createdAt).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>

              {/* Right Column: Score Breakdown */}
              <div className="space-y-5">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Score Breakdown</h3>
                  <div className="space-y-2.5">
                    {CRITERIA.map(c => {
                      const score = active[c.key];
                      const pct = (score / 5) * 100;
                      return (
                        <div key={c.key} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
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
                </div>

                <div className="flex items-center justify-between bg-[#F6F9FF] rounded-xl px-4 py-3 border border-blue-50">
                  <span className="text-sm font-bold text-gray-600 flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-[#FF9000] fill-current" /> Total Score
                  </span>
                  <span className="text-lg font-black text-[#004f9f]">{active.totalScore}/20</span>
                </div>

                {/* Remarks */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Evaluator Remarks</h3>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-700 italic">
                    {active.remarks ? active.remarks : 'No remarks provided.'}
                  </div>
                </div>

                <div className="flex gap-3">
                  {isSuperAdmin && (
                    <Link
                      href={`/dashboard/evaluator/evaluate-content?videoId=${active.videoId}`}
                      className="flex-1 flex items-center justify-center gap-2 bg-amber-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-amber-600 transition-colors"
                    >
                      <Pencil size={14} /> Re-evaluate
                    </Link>
                  )}
                  <button
                    onClick={() => setActive(null)}
                    className={`${isSuperAdmin ? 'flex-1' : 'w-full'} bg-[#004f9f] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-[#003d7a] transition-colors`}
                  >
                    Close Detail
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
