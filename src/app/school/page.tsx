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

function Sparkline({ color }: { color: string }) {
  return (
    <svg width="72" height="32" viewBox="0 0 72 32" fill="none" className="flex-shrink-0">
      <path
        d="M1 24 C8 26, 14 10, 21 14 C28 18, 32 6, 40 9 C48 12, 52 22, 59 16 C64 12, 67 18, 71 8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
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
    const token = sessionStorage.getItem('schoolToken');
    const raw = sessionStorage.getItem('schoolUser');
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
      delta: null as string | null,
      icon: Hash,
      iconBg: 'bg-[#1559C7]/10',
      iconColor: 'text-[#1559C7]',
      sparkColor: '#1559C7',
      link: '/school/olympiad-ids',
      linkText: 'View All IDs',
    },
    {
      label: 'Registered Students',
      value: stats?.totalRegistered ?? 0,
      delta: stats ? `${stats.registrationRate}%` : null,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
      sparkColor: '#10b981',
      link: '/school/registered-students',
      linkText: 'View Students',
    },
    {
      label: 'Pending Registrations',
      value: stats?.totalPending ?? 0,
      delta: null as string | null,
      icon: AlertCircle,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
      sparkColor: '#f59e0b',
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
            <div key={card.label} className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] p-5">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={16} className={card.iconColor} />
                </div>
                <p className="text-xs text-[#67748E] pt-1.5">{card.label}</p>
              </div>
              <div className="flex items-end justify-between mt-3">
                <div className="min-w-0">
                  {loading ? (
                    <div className="h-7 w-16 bg-gray-100 animate-pulse rounded" />
                  ) : (
                    <p className="text-xl font-bold text-[#0D1A06]">
                      {card.value}
                      {card.delta && <span className="text-emerald-500 text-sm font-bold ml-1">+{card.delta}</span>}
                    </p>
                  )}
                  <Link href={card.link} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#67748E] hover:text-[#0D1A06] mt-1.5 transition-colors">
                    {card.linkText} <ArrowRight size={9} />
                  </Link>
                </div>
                <Sparkline color={card.sparkColor} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Registration Rate + Class-wise Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Ring Chart */}
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] flex flex-col items-center justify-center py-6 px-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Registration Rate</p>
          <div className="relative">
            <RingChart rate={stats?.registrationRate ?? 0} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {loading ? (
                <div className="h-8 w-12 bg-gray-100 animate-pulse rounded" />
              ) : (
                <>
                  <span className="text-2xl font-black text-black">{stats?.registrationRate ?? 0}%</span>
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
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <BookOpen size={14} className="text-black" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-black">Class-wise Registration Progress</h2>
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
                      <span className="text-xs font-bold text-black">{cls.className}</span>
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
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-black" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-black">Recent Registrations</h2>
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
                    <p className="text-sm font-semibold text-black truncate">{s.studentName}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{s.olympiadCode} · {s.className}</p>
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
              <Link href="/school/registered-students" className="text-[10px] font-bold text-black hover:underline flex items-center gap-1 uppercase tracking-wider">
                View all students <ChevronRight size={10} />
              </Link>
            </div>
          ) : null}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp size={14} className="text-black" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-black">Quick Actions</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: 'View All IDs', sub: 'See allocated roll numbers', icon: Hash, href: '/school/olympiad-ids', color: 'text-[#1559C7]', bg: 'bg-[#1559C7]/[0.06] hover:bg-[#1559C7]/10' },
              { label: 'My Students', sub: 'Registered student list', icon: Users, href: '/school/registered-students', color: 'text-emerald-600', bg: 'bg-emerald-500/[0.06] hover:bg-emerald-500/10' },
              { label: 'School Profile', sub: 'Manage school details', icon: Award, href: '/school/profile', color: 'text-purple-600', bg: 'bg-purple-500/[0.06] hover:bg-purple-500/10' },
              { label: 'Event Data', sub: 'View event statistics', icon: Clock, href: '/school/registered-students', color: 'text-amber-600', bg: 'bg-amber-500/[0.06] hover:bg-amber-500/10' },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.href + a.label} href={a.href}
                  className={`${a.bg} rounded-xl p-4 transition-all group relative`}>
                  <div className={`w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center mb-2.5`}>
                    <Icon size={15} className={a.color} />
                  </div>
                  <ArrowRight size={13} className={`absolute top-4 right-4 ${a.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <p className="text-xs font-bold text-[#0D1A06]">{a.label}</p>
                  <p className="text-[10px] text-[#67748E] mt-0.5">{a.sub}</p>
                </Link>
              );
            })}
          </div>

          {/* Info Panel */}
          <div className="mx-4 mb-4 bg-gradient-to-br from-[#1559C7] to-[#3CB043] text-white p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -bottom-8 -left-4 w-16 h-16 rounded-full bg-white/10" />
            <p className="text-sm font-bold mb-1.5 relative">How it works</p>
            <p className="text-[11px] text-white/80 leading-relaxed relative">
              Share the Olympiad ID (roll number) with each student. They register on the TalentOlympiad App using that ID — their profile then appears in your &quot;My Students&quot; section.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

