'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  School, Hash, Users, AlertCircle, UploadCloud, Smartphone,
  Clock, CheckCircle2, XCircle, ArrowRight, BookOpen, Activity,
  PlaySquare, ChevronRight, KeyRound, BarChart2,
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

export default function Dashboard() {
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
