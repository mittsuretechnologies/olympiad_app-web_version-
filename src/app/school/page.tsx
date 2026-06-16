'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Hash, Users, TrendingUp, Clock,
  ArrowRight, CheckCircle2, AlertCircle, BookOpen, Activity,
  ChevronRight, Award
} from 'lucide-react';

interface Stats {
  totalAllocated: number;
  totalRegistered: number;
  totalPending: number;
  registrationRate: number;
  classwiseBreakdown: {
    className: string;
    classCode: string;
    allocated: number;
    registered: number;
    pending: number;
    rate: number;
  }[];
  recentRegistrations: {
    studentName: string;
    olympiadCode: string;
    className: string;
    registeredAt: string;
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

export default function SchoolDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('schoolToken');
    const raw = localStorage.getItem('schoolUser');
    if (raw) {
      try { setSchoolName(JSON.parse(raw)?.name || ''); } catch {}
    }
    if (!token) { setLoading(false); return; }

    fetch('/api/school/me/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setStats(d))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good Morning' :
    now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  const topStatCards = [
    {
      label: 'Total Allocated IDs',
      value: stats?.totalAllocated ?? 0,
      icon: Hash,
      color: 'bg-blue-600',
      textColor: 'text-blue-700',
      bg: 'bg-blue-50',
      link: '/school/olympiad-ids',
      linkText: 'View All IDs',
    },
    {
      label: 'Registered Students',
      value: stats?.totalRegistered ?? 0,
      icon: CheckCircle2,
      color: 'bg-green-600',
      textColor: 'text-green-700',
      bg: 'bg-green-50',
      link: '/school/registered-students',
      linkText: 'View Students',
    },
    {
      label: 'Pending Registrations',
      value: stats?.totalPending ?? 0,
      icon: AlertCircle,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      bg: 'bg-orange-50',
      link: '/school/olympiad-ids',
      linkText: 'View Pending IDs',
    },
  ];

  return (
    <div className="space-y-5">

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topStatCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className={`absolute top-0 left-0 w-1 h-full ${card.color}`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{card.label}</p>
                    {loading ? (
                      <div className="h-9 w-16 bg-gray-100 animate-pulse rounded" />
                    ) : (
                      <p className={`text-4xl font-black ${card.textColor}`}>{card.value}</p>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl ${card.bg} group-hover:scale-110 transition-transform`}>
                    <Icon size={22} className={card.textColor} />
                  </div>
                </div>
                <Link href={card.link} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#004f9f] hover:underline uppercase tracking-wider mt-1">
                  {card.linkText} <ArrowRight size={10} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Registration Rate + Class-wise Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Ring Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-6 px-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Registration Rate</p>
          <div className="relative">
            <RingChart rate={stats?.registrationRate ?? 0} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {loading ? (
                <div className="h-8 w-12 bg-gray-100 animate-pulse rounded" />
              ) : (
                <>
                  <span className="text-2xl font-black text-[#004f9f]">{stats?.registrationRate ?? 0}%</span>
                  <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Complete</span>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-4 text-xs text-gray-500">
            <span><span className="font-bold text-green-600">{stats?.totalRegistered ?? 0}</span> Registered</span>
            <span><span className="font-bold text-orange-500">{stats?.totalPending ?? 0}</span> Pending</span>
          </div>
        </div>

        {/* Class-wise Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <BookOpen size={14} className="text-[#004f9f]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#004f9f]">Class-wise Registration Progress</h2>
          </div>
          <div className="p-5 space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-24 bg-gray-100 animate-pulse rounded" />
                  <div className="h-2 w-full bg-gray-100 animate-pulse rounded-full" />
                </div>
              ))
            ) : !stats?.classwiseBreakdown?.length ? (
              <p className="text-sm text-gray-400 text-center py-6">No class data available yet.</p>
            ) : (
              stats.classwiseBreakdown.map((cls) => (
                <div key={cls.classCode}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#004f9f]">{cls.className}</span>
                      <span className="text-[10px] text-gray-400">{cls.registered}/{cls.allocated}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      cls.rate === 100 ? 'bg-green-100 text-green-700' :
                      cls.rate >= 50 ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>{cls.rate}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        cls.rate === 100 ? 'bg-green-500' :
                        cls.rate >= 50 ? 'bg-blue-500' : 'bg-orange-400'
                      }`}
                      style={{ width: `${cls.rate}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Registrations */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[#004f9f]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#004f9f]">Recent Registrations</h2>
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
            ) : !stats?.recentRegistrations?.length ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                No student registrations yet.
              </div>
            ) : (
              stats.recentRegistrations.map((s, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#06013E] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {s.studentName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#004f9f] truncate">{s.studentName}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{s.olympiadCode} Â· {s.className}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-gray-400">
                      {new Date(s.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </p>
                    <CheckCircle2 size={12} className="text-green-500 ml-auto mt-0.5" />
                  </div>
                </div>
              ))
            )}
          </div>
          {stats?.recentRegistrations?.length ? (
            <div className="px-5 py-2.5 border-t border-gray-100">
              <Link href="/school/registered-students" className="text-[10px] font-bold text-[#004f9f] hover:underline flex items-center gap-1 uppercase tracking-wider">
                View all students <ChevronRight size={10} />
              </Link>
            </div>
          ) : null}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp size={14} className="text-[#004f9f]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#004f9f]">Quick Actions</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: 'View All IDs', sub: 'See allocated roll numbers', icon: Hash, href: '/school/olympiad-ids', color: 'text-blue-600', bg: 'bg-blue-50 hover:bg-blue-100' },
              { label: 'My Students', sub: 'Registered student list', icon: Users, href: '/school/registered-students', color: 'text-green-600', bg: 'bg-green-50 hover:bg-green-100' },
              { label: 'School Profile', sub: 'View school details', icon: Award, href: '/school/profile', color: 'text-purple-600', bg: 'bg-purple-50 hover:bg-purple-100' },
              { label: 'Export Data', sub: 'Download CSV reports', icon: Clock, href: '/school/registered-students', color: 'text-orange-600', bg: 'bg-orange-50 hover:bg-orange-100' },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.href + a.label} href={a.href}
                  className={`${a.bg} border border-transparent hover:border-gray-200 p-4 transition-all group flex flex-col gap-2`}>
                  <div className={`w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icon size={16} className={a.color} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#004f9f]">{a.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{a.sub}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Info Panel */}
          <div className="mx-4 mb-4 bg-[#06013E] text-white p-4 rounded-lg">
            <p className="text-xs font-bold mb-1">How it works</p>
            <p className="text-[10px] text-white/60 leading-relaxed">
              Share the Olympiad ID (roll number) with each student. They register on the TalentOlympiad App using that ID â€” their profile then appears in your "My Students" section.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

