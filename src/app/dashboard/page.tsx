'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  School, Hash, Users, AlertCircle, UploadCloud, Smartphone,
  Clock, CheckCircle2, XCircle, ArrowRight, BookOpen, Activity,
  PlaySquare, ChevronRight, KeyRound, BarChart2, Star, Loader2
} from 'lucide-react';

interface Overview {
  stats: {
    totalSchools: number;
    activeSchools: number;
    totalAllocatedIds: number;
    totalRegisteredStudents: number;
    totalPendingRegistrations: number;
    registrationRate: number;
    totalUploaders: number;
    totalAppUsers: number;
    pendingVideos: number;
    approvedVideos: number;
    rejectedVideos: number;
  };
  topSchools: {
    id: string; name: string; schoolId: string; city: string | null; state: string | null;
    allocated: number; registered: number; rate: number;
  }[];
  recentStudents: { id: string; name: string; olympiadCode: string; schoolName: string; createdAt: string }[];
  recentVideos: { id: string; caption: string | null; status: string; uploaderType: string; studentName: string | null; createdAt: string }[];
}

interface EvaluatorStats {
  stats: {
    totalEvaluated: number;
    averageScore: number;
    pendingQueue: number;
  };
  criteriaAvg: {
    confidenceScore: number;
    creativityScore: number;
    techniqueScore: number;
    presentationScore: number;
  };
  recentEvaluations: {
    id: string;
    videoId: string;
    studentName: string;
    olympiadCode: string;
    category: string;
    subCategory: string;
    totalScore: number;
    createdAt: string;
  }[];
}

function RingChart({ rate }: { rate: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" className="rotate-[-90deg]">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#E8EAF6" strokeWidth="10" />
      <circle
        cx="55" cy="55" r={r} fill="none"
        stroke={rate >= 75 ? '#16a34a' : rate >= 40 ? '#2563eb' : '#ea580c'}
        strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  );
}

function SuperAdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/overview')
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats;

  const topStatCards = [
    { label: 'Total Schools', value: s?.totalSchools ?? 0, sub: `${s?.activeSchools ?? 0} active`, icon: School, textColor: 'text-blue-700', bg: 'bg-blue-100', link: '/dashboard/schools', linkText: 'View Schools' },
    { label: 'Allocated IDs', value: s?.totalAllocatedIds ?? 0, sub: `${s?.totalRegisteredStudents ?? 0} registered`, icon: Hash, textColor: 'text-indigo-700', bg: 'bg-indigo-100', link: '/dashboard/credentials/students', linkText: 'Manage IDs' },
    { label: 'Registered Students', value: s?.totalRegisteredStudents ?? 0, sub: `${s?.registrationRate ?? 0}% rate`, icon: CheckCircle2, textColor: 'text-green-700', bg: 'bg-green-100', link: '/dashboard/credentials/registered-students', linkText: 'View Students' },
    { label: 'Pending Registrations', value: s?.totalPendingRegistrations ?? 0, sub: 'awaiting signup', icon: AlertCircle, textColor: 'text-orange-600', bg: 'bg-orange-100', link: '/dashboard/schools', linkText: 'Follow Up' },
    { label: 'Uploaders', value: s?.totalUploaders ?? 0, sub: 'registered', icon: UploadCloud, textColor: 'text-purple-700', bg: 'bg-purple-100', link: '/dashboard/uploaders', linkText: 'View Uploaders' },
    { label: 'App Users', value: s?.totalAppUsers ?? 0, sub: 'mobile signups', icon: Smartphone, textColor: 'text-teal-700', bg: 'bg-teal-100', link: '/dashboard/app-users', linkText: 'View Users' },
  ];

  const moderationCards = [
    { label: 'Pending', value: s?.pendingVideos ?? 0, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Approved', value: s?.approvedVideos ?? 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Rejected', value: s?.rejectedVideos ?? 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-medium text-[#004f9f]">Dashboard</h1>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {topStatCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-xl ${card.bg}`}>
                  <Icon size={18} className={card.textColor} />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-black mb-1">{card.label}</p>
                {loading ? (
                  <div className="h-7 w-12 bg-gray-100 animate-pulse rounded" />
                ) : (
                  <p className={`text-2xl font-black ${card.textColor}`}>{card.value}</p>
                )}
                <p className="text-[10px] text-black mt-0.5">{card.sub}</p>
              </div>
              <Link href={card.link} className="inline-flex items-center gap-1 text-[10px] font-bold text-black hover:text-[#004f9f] hover:underline uppercase tracking-wider mt-auto">
                {card.linkText} <ArrowRight size={10} />
              </Link>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Registration Rate Ring */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-6 px-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-black mb-4">Registration Rate</p>
          <div className="relative">
            <RingChart rate={s?.registrationRate ?? 0} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {loading ? (
                <div className="h-8 w-12 bg-gray-100 animate-pulse rounded" />
              ) : (
                <>
                  <span className="text-2xl font-black text-[#1F2937]">{s?.registrationRate ?? 0}%</span>
                  <span className="text-[9px] text-black uppercase font-bold tracking-wider">Complete</span>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-4 text-xs text-black">
            <span><span className="font-bold text-green-600">{s?.totalRegisteredStudents ?? 0}</span> Registered</span>
            <span><span className="font-bold text-orange-500">{s?.totalPendingRegistrations ?? 0}</span> Pending</span>
          </div>
        </div>

        {/* Video Moderation Summary */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlaySquare size={14} className="text-[#1F2937]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#1F2937]">Video Moderation</h2>
            </div>
            <Link href="/dashboard/videos" className="text-[10px] font-bold text-black hover:text-[#004f9f] hover:underline uppercase tracking-wider flex items-center gap-1">
              Review Now <ChevronRight size={10} />
            </Link>
          </div>
          <div className="p-5 grid grid-cols-3 gap-3">
            {moderationCards.map(m => {
              const Icon = m.icon;
              return (
                <div key={m.label} className={`${m.bg} rounded-lg p-4 flex flex-col gap-2 shadow-md border border-black/5`}>
                  <Icon size={18} className={m.color} />
                  {loading ? (
                    <div className="h-7 w-10 bg-white/60 animate-pulse rounded" />
                  ) : (
                    <span className={`text-2xl font-black ${m.color}`}>{m.value}</span>
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-black">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Schools */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-[#1F2937]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#1F2937]">Top Schools by Registrations</h2>
            </div>
            <Link href="/dashboard/schools" className="text-[10px] font-bold text-black hover:text-[#004f9f] hover:underline uppercase tracking-wider flex items-center gap-1">
              All Schools <ChevronRight size={10} />
            </Link>
          </div>
          <div className="p-5 space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-32 bg-gray-100 animate-pulse rounded" />
                  <div className="h-2 w-full bg-gray-100 animate-pulse rounded-full" />
                </div>
              ))
            ) : !data?.topSchools?.length ? (
              <p className="text-sm text-black text-center py-6">No school data available yet.</p>
            ) : (
              data.topSchools.map(school => (
                <div key={school.id}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-[#1F2937] truncate">{school.name}</span>
                      <span className="text-[10px] text-black flex-shrink-0">{school.registered}/{school.allocated}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                      school.rate === 100 ? 'bg-green-100 text-green-700' :
                      school.rate >= 50 ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>{school.rate}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        school.rate === 100 ? 'bg-green-500' : school.rate >= 50 ? 'bg-blue-500' : 'bg-orange-400'
                      }`}
                      style={{ width: `${school.rate}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <KeyRound size={14} className="text-[#1F2937]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#1F2937]">Quick Actions</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Register School', icon: School, href: '/dashboard/schools/register' },
              { label: 'Moderation', icon: PlaySquare, href: '/dashboard/videos' },
              { label: 'Credentials', icon: KeyRound, href: '/dashboard/credentials/schools' },
              { label: 'Reports', icon: BarChart2, href: '/dashboard/reports/schools' },
            ].map(a => {
              const Icon = a.icon;
              return (
                <Link key={a.href} href={a.href}
                  className="bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-lg p-4 transition-all flex flex-col gap-2">
                  <Icon size={16} className="text-black" />
                  <p className="text-xs font-bold text-[#1F2937]">{a.label}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Registrations */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[#1F2937]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#1F2937]">Recent Registrations</h2>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-gray-100 animate-pulse rounded" />
                    <div className="h-2 w-20 bg-gray-100 animate-pulse rounded" />
                  </div>
                </div>
              ))
            ) : !data?.recentStudents?.length ? (
              <div className="px-5 py-8 text-center text-black text-sm">No registrations yet.</div>
            ) : (
              data.recentStudents.map(stu => (
                <div key={stu.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#052E5C] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {stu.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1F2937] truncate">{stu.name}</p>
                    <p className="text-[10px] text-black truncate">{stu.olympiadCode} · {stu.schoolName}</p>
                  </div>
                  <span className="text-[10px] text-black flex-shrink-0">{new Date(stu.createdAt).toLocaleDateString('en-IN')}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Video Uploads */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-[#1F2937]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#1F2937]">Recent Video Uploads</h2>
            </div>
            <Link href="/dashboard/videos" className="text-[10px] font-bold text-black hover:text-[#004f9f] hover:underline uppercase tracking-wider flex items-center gap-1">
              View All <ChevronRight size={10} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-gray-100 animate-pulse rounded" />
                    <div className="h-2 w-20 bg-gray-100 animate-pulse rounded" />
                  </div>
                </div>
              ))
            ) : !data?.recentVideos?.length ? (
              <div className="px-5 py-8 text-center text-black text-sm">No video uploads yet.</div>
            ) : (
              data.recentVideos.map(v => (
                <div key={v.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    v.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                    v.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    <PlaySquare size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1F2937] truncate">{v.studentName || v.uploaderType}</p>
                    <p className="text-[10px] text-black truncate">{v.caption || 'No caption'}</p>
                  </div>
                  <span className="text-[10px] text-black flex-shrink-0">{new Date(v.createdAt).toLocaleDateString('en-IN')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EvaluatorDashboard() {
  const [data, setData] = useState<EvaluatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('evaluatorToken');
    fetch('/api/evaluator/me/dashboard-stats', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async r => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to fetch evaluator stats');
        }
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-28 bg-gray-100 rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center text-red-600">
        <AlertCircle className="mx-auto w-10 h-10 mb-2" />
        <p className="font-semibold">Error loading dashboard</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  const stats = data?.stats;
  const criteria = data?.criteriaAvg;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#004f9f] to-[#002f5f] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-xl font-bold">Evaluator Dashboard</h2>
          <p className="text-sm text-blue-100 mt-1">
            Assess and grade student performance submissions for the Olympiad.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/dashboard/evaluator/evaluate-content"
              className="inline-flex items-center gap-2 bg-[#009846] hover:bg-[#007c39] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
            >
              Start Evaluating <ArrowRight size={14} />
            </Link>
            <Link
              href="/dashboard/evaluator/history"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/25 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              View History
            </Link>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-1/10 translate-y-1/10">
          <Star size={200} className="text-white" fill="white" />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Evaluated Submissions', value: stats?.totalEvaluated ?? 0, icon: CheckCircle2, color: 'text-green-600 bg-green-50 border-green-100' },
          { label: 'Average Score Given', value: `${stats?.averageScore ?? 0}/20`, icon: Star, color: 'text-amber-600 bg-amber-50 border-amber-100' },
          { label: 'Pending in Queue', value: stats?.pendingQueue ?? 0, icon: Clock, color: 'text-blue-600 bg-blue-50 border-blue-100' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{card.label}</p>
                <p className="text-2xl font-black text-gray-800">{card.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.color.split(' ')[0]} ${card.color.split(' ')[1]} border ${card.color.split(' ')[2]}`}>
                <Icon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Layout Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Evaluations */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Activity size={16} className="text-[#004f9f]" /> Recent Evaluations
            </h3>
            <Link href="/dashboard/evaluator/history" className="text-xs font-bold text-[#004f9f] hover:underline uppercase tracking-wider flex items-center gap-1">
              All History <ChevronRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50 flex-1">
            {!data?.recentEvaluations?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Clock size={36} className="text-gray-300 mb-2" />
                <p className="text-xs">No evaluations completed yet.</p>
              </div>
            ) : (
              data.recentEvaluations.map(e => (
                <div key={e.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{e.studentName}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{e.olympiadCode} · {e.category} / {e.subCategory}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs text-gray-400 font-medium">
                      {new Date(e.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className="bg-[#004f9f]/10 text-[#004f9f] text-xs font-black px-2.5 py-1 rounded-lg">
                      {e.totalScore}/20
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Criteria Breakdown */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
            <Star size={16} className="text-[#004f9f]" /> Average Score Breakdown
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Confidence & Stage Presence', val: criteria?.confidenceScore ?? 0, color: 'bg-green-500' },
              { label: 'Creativity & Originality', val: criteria?.creativityScore ?? 0, color: 'bg-amber-500' },
              { label: 'Technique & Skill', val: criteria?.techniqueScore ?? 0, color: 'bg-blue-500' },
              { label: 'Presentation & Overall Impact', val: criteria?.presentationScore ?? 0, color: 'bg-purple-500' },
            ].map(c => {
              const pct = (c.val / 5) * 100;
              return (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-gray-600 truncate mr-2">{c.label}</span>
                    <span className="font-black text-gray-800 shrink-0">{c.val}/5</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${c.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewerDashboard() {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/overview')
      .then(r => r.json())
      .then(d => setPendingCount(d?.stats?.pendingVideos ?? 0))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-md">
        <h2 className="text-xl font-bold">Reviewer Dashboard</h2>
        <p className="text-sm text-blue-100 mt-1">
          Review and moderate uploaded videos to approve or reject them for Olympiad entry.
        </p>
        <div className="mt-4">
          <Link
            href="/dashboard/reviewer/review-content"
            className="inline-flex items-center gap-2 bg-[#009846] hover:bg-[#007c39] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            Start Moderating <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm max-w-sm flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Awaiting Moderation</p>
          <p className="text-2xl font-black text-gray-800">{loading ? '...' : pendingCount}</p>
        </div>
        <div className="p-3 rounded-xl bg-orange-50 text-orange-600">
          <Clock size={20} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [role, setRole] = useState<'SUPERADMIN' | 'REVIEWER' | 'EVALUATOR' | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const reviewerToken = sessionStorage.getItem('reviewerToken');
    const evaluatorToken = sessionStorage.getItem('evaluatorToken');

    if (reviewerToken && !token) {
      setRole('REVIEWER');
    } else if (evaluatorToken && !token) {
      setRole('EVALUATOR');
    } else {
      setRole('SUPERADMIN');
    }
  }, []);

  if (role === null) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (role === 'EVALUATOR') {
    return <EvaluatorDashboard />;
  }

  if (role === 'REVIEWER') {
    return <ReviewerDashboard />;
  }

  return <SuperAdminDashboard />;
}
