'use client';

import useSWR from 'swr';
import { AlertTriangle, Award, CheckCircle2, Download, Loader2, Trophy, Users, Video } from 'lucide-react';
import { fetcher } from '@/lib/swr';

type VideoStatus = 'NOT_SUBMITTED' | 'IN_MODERATION' | 'REJECTED' | 'IN_EVALUATION' | 'SCORED';

interface Student {
  olympiadCode: string;
  name: string;
  className: string | null;
  schoolName: string | null;
  schoolCode: string | null;
  district: string | null;
  state: string | null;
  schoolPercent: number;
  videoStatus: VideoStatus;
  videoMarks: number | null;
  statePercent: number | null;
  rank: number | null;
}
interface Tier { rank: number; statePercent: number; students: Student[] }
interface Response { stateTopN: number; nationalTopN: number; videoMarks: number; students: Student[]; topPercents: number[]; winners: Tier[] }

const STATUS: Record<VideoStatus, { label: string; cls: string }> = {
  NOT_SUBMITTED: { label: 'No video yet', cls: 'bg-gray-50 border-gray-200 text-gray-600' },
  IN_MODERATION: { label: 'In moderation', cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  REJECTED: { label: 'Video rejected', cls: 'bg-red-50 border-red-200 text-red-700' },
  IN_EVALUATION: { label: 'In evaluation', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  SCORED: { label: 'Scored', cls: 'bg-green-50 border-green-200 text-green-700' },
};

const RANK_STYLE = [
  'bg-amber-50 border-amber-200 text-amber-800',
  'bg-slate-50 border-slate-200 text-slate-700',
  'bg-orange-50 border-orange-200 text-orange-800',
];

export default function StateRoundPage() {
  const { data, error, isLoading } = useSWR<Response>('/api/result/state-round', fetcher, { revalidateOnFocus: false });

  const students = data?.students ?? [];
  const submitted = students.filter(s => s.videoStatus !== 'NOT_SUBMITTED').length;
  const scored = students.filter(s => s.videoStatus === 'SCORED').length;
  const nationalPool = students.filter(s => s.rank !== null).length;

  const exportCsv = () => {
    const header = ['National pool rank', 'State %', `Video marks /${data?.videoMarks}`, 'Student', 'Olympiad ID', 'Class', 'School', 'School ID', 'District', 'State', 'School round %', 'Video status'];
    const lines = students.map(s => [
      s.rank ?? '', s.statePercent ?? '', s.videoMarks ?? '', s.name, s.olympiadCode, s.className || '', s.schoolName || '', s.schoolCode || '',
      s.district || '', s.state || '', s.schoolPercent, STATUS[s.videoStatus].label,
    ]);
    const csv = [header, ...lines].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url; a.download = `state-round-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-[#009846]" />
      </div>
    );
  }
  if (error || !data) {
    return <div className="bg-white rounded-2xl border border-red-100 shadow-sm py-10 text-center text-red-500 font-medium">Could not load the state round. Please refresh.</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
            <h1 className="text-2xl font-medium text-[#004f9f]">State Round &amp; National Winners</h1>
          </div>
        <button onClick={exportCsv} disabled={students.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
        <span>The online interview is not part of the score yet. These ranks use the state video alone, so they can change once interview marks are added.</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Forwarded to state', value: students.length, icon: <Users size={18} />, color: 'from-blue-500 to-indigo-600' },
          { label: 'Video submitted', value: submitted, icon: <Video size={18} />, color: 'from-violet-500 to-purple-600' },
          { label: 'Scored', value: scored, icon: <CheckCircle2 size={18} />, color: 'from-emerald-500 to-green-600' },
          { label: 'In national pool', value: nationalPool, icon: <Award size={18} />, color: 'from-amber-400 to-orange-500' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${c.color} shadow-md flex items-center justify-center text-white`}>{c.icon}</div>
              <span className="text-xs text-gray-400 font-semibold">{c.label}</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{c.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 bg-gray-50/60">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center flex-shrink-0">
            <Trophy size={16} />
          </div>
          <p className="font-extrabold text-gray-900 text-[14px]">National winners: top {data.nationalTopN} holistic percentages</p>
        </div>
        {data.winners.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400 font-medium">No state video has a published score yet.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.winners.map(t => (
              <li key={t.rank} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <div className="flex items-center gap-2 w-28 flex-shrink-0">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-black ${RANK_STYLE[t.rank - 1] || RANK_STYLE[2]}`}>#{t.rank}</span>
                  <span className="text-base font-black text-gray-900">{t.statePercent}%</span>
                </div>
                <div className="flex flex-wrap gap-2 flex-1 min-w-0">
                  {t.students.map(st => (
                    <span key={st.olympiadCode} className="inline-flex flex-col px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-[13px] font-bold text-gray-800">{st.name}</span>
                      <span className="font-mono text-[11px] text-gray-500">{st.olympiadCode}{st.className ? ` · ${st.className}` : ''}</span>
                      <span className="text-[11px] text-gray-400">{st.schoolName || st.schoolCode || '—'}</span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                {['Pool rank', 'State %', `Video /${data.videoMarks}`, 'Student', 'School', 'District', 'School round %', 'Video'].map(h => (
                  <th key={h} className="py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={8} className="py-14 text-center text-gray-400 font-medium">Nobody has been forwarded to the state level yet.</td></tr>
              )}
              {students.map(s => (
                <tr key={s.olympiadCode} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="py-3 px-3 font-bold text-gray-500">{s.rank ? `#${s.rank}` : '—'}</td>
                  <td className="py-3 px-3 font-black text-gray-900">{s.statePercent === null ? '—' : `${s.statePercent}%`}</td>
                  <td className="py-3 px-3 text-gray-700">{s.videoMarks ?? '—'}</td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-gray-900 text-[13px]">{s.name}</p>
                    <p className="font-mono text-[11px] text-gray-500">{s.olympiadCode}{s.className ? ` · ${s.className}` : ''}</p>
                  </td>
                  <td className="py-3 px-3 max-w-[220px]">
                    <p className="text-[13px] text-gray-700 truncate" title={s.schoolName || ''}>{s.schoolName || '—'}</p>
                    <p className="font-mono text-[11px] text-gray-400">{s.schoolCode || ''}</p>
                  </td>
                  <td className="py-3 px-3 text-gray-700">{s.district?.trim() || '—'}</td>
                  <td className="py-3 px-3 text-gray-500">{s.schoolPercent}%</td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${STATUS[s.videoStatus].cls}`}>{STATUS[s.videoStatus].label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
