'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Lottie from 'lottie-react';
import {
  Hash, Users, TrendingUp, Clock,
  ArrowRight, CheckCircle2, AlertCircle, BookOpen, Activity,
  ChevronRight, Award, Sparkles, Flame, GraduationCap
} from 'lucide-react';

// Mascot animation shown in the greeting banner — fetched at runtime
// since the source file lives in /public with spaces/capitals in its name.
function MascotAnimation({ className }: { className?: string }) {
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    fetch('/Luma%20Left%20hand%20Animation.json')
      .then(r => r.json())
      .then(setAnimationData)
      .catch(() => {});
  }, []);

  if (!animationData) return null;
  return <Lottie animationData={animationData} loop autoplay className={className} />;
}

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
    username: string | null;
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
  const r = 68;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  return (
    <svg width="170" height="170" viewBox="0 0 170 170" className="rotate-[-90deg]">
      <defs>
        <linearGradient id="ringFillGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="50%" stopColor="#eda100" />
          <stop offset="80%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <circle cx="85" cy="85" r={r} fill="none" stroke="#E8EAF6" strokeWidth="14" />
      <circle
        cx="85" cy="85" r={r} fill="none"
        stroke="url(#ringFillGradient)"
        strokeWidth="14"
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
      gradient: 'from-[#1559C7] to-[#2a78d6]',
      sparkColor: '#ffffff',
      link: '/school/olympiad-ids',
      linkText: 'View All IDs',
    },
    {
      label: 'Registered Students',
      value: stats?.totalRegistered ?? 0,
      delta: stats ? `${stats.registrationRate}%` : null,
      icon: CheckCircle2,
      gradient: 'from-[#0d9f6e] to-[#1baf7a]',
      sparkColor: '#ffffff',
      link: '/school/registered-students',
      linkText: 'View Students',
    },
    {
      label: 'Pending Registrations',
      value: stats?.totalPending ?? 0,
      delta: null as string | null,
      icon: AlertCircle,
      gradient: 'from-[#d98600] to-[#eda100]',
      sparkColor: '#ffffff',
      link: '/school/olympiad-ids',
      linkText: 'View Pending IDs',
    },
  ];

  const dotTexture: React.CSSProperties = {
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(11,11,11,0.035) 0px, rgba(11,11,11,0.035) 1px, transparent 1px, transparent 10px)',
  };

  return (
    <div className="space-y-5">

      {/* Greeting Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d1a6e] via-[#1559C7] to-[#3CB043] p-6 text-white shadow-[0_8px_24px_rgba(21,89,199,0.25)]">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 right-24 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute top-8 right-40 w-3 h-3 rounded-full bg-white/40" />
        <div className="absolute bottom-10 right-12 w-2 h-2 rounded-full bg-white/50" />
        <MascotAnimation className="hidden md:block absolute bottom-0 right-6 w-32 h-32" />
        <div className="relative flex items-center gap-2 mb-1.5">
          <Sparkles size={16} className="text-yellow-300" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">{greeting}</p>
        </div>
        <h1 className="relative text-2xl font-black tracking-tight">
          {schoolName || 'Welcome back'} <span className="align-middle">👋</span>
        </h1>
        <p className="relative text-[13px] text-white/75 mt-1.5 max-w-md">
          Here&apos;s a quick look at your olympiad activity — allocations, registrations, and recent student sign-ups.
        </p>
        {!loading && stats && (
          <div className="relative flex items-center gap-2 mt-4">
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
              <Flame size={13} className="text-orange-300" />
              <span className="text-[11px] font-bold">{stats.registrationRate}% Registration Rate</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
              <GraduationCap size={13} className="text-emerald-300" />
              <span className="text-[11px] font-bold">{stats.totalRegistered} Students Onboarded</span>
            </div>
          </div>
        )}
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topStatCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`relative overflow-hidden bg-gradient-to-br ${card.gradient} rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.12)] p-5 text-white`}>
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
              <div className="absolute -bottom-8 -left-6 w-20 h-20 rounded-full bg-white/10" />
              <div className="relative flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-white" />
                </div>
                <p className="text-xs text-white/85 pt-1.5 font-semibold">{card.label}</p>
              </div>
              <div className="relative flex items-end justify-between mt-3">
                <div className="min-w-0">
                  {loading ? (
                    <div className="h-7 w-16 bg-white/20 animate-pulse rounded" />
                  ) : (
                    <p className="text-2xl font-black">
                      {card.value}
                      {card.delta && <span className="text-yellow-300 text-sm font-bold ml-1">+{card.delta}</span>}
                    </p>
                  )}
                  <Link href={card.link} className="inline-flex items-center gap-1 text-[10px] font-bold text-white/80 hover:text-white mt-1.5 transition-colors">
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
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] flex flex-col items-center justify-center py-6 px-4" style={dotTexture}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Registration Rate</p>
          <div className="relative">
            <RingChart rate={stats?.registrationRate ?? 0} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {loading ? (
                <div className="h-8 w-12 bg-gray-100 animate-pulse rounded" />
              ) : (
                <>
                  <span className="text-4xl font-black text-black">{stats?.registrationRate ?? 0}%</span>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-0.5">Complete</span>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="font-bold text-green-600">{stats?.totalRegistered ?? 0}</span> Registered</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /><span className="font-bold text-orange-500">{stats?.totalPending ?? 0}</span> Pending</span>
          </div>
        </div>

        {/* Class-wise Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2]" style={dotTexture}>
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gradient-to-r from-[#1559C7]/5 to-transparent rounded-t-2xl">
            <BookOpen size={14} className="text-[#1559C7]" />
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
                      className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${
                        cls.rate === 100 ? 'from-green-500 to-emerald-400' :
                        cls.rate >= 50 ? 'from-blue-500 to-[#2a78d6]' : 'from-orange-400 to-amber-300'
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

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2]">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-gradient-to-r from-purple-500/5 to-transparent rounded-t-2xl">
            <TrendingUp size={14} className="text-purple-600" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-black">Quick Actions</h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'View All IDs', sub: 'See allocated roll numbers', icon: Hash, href: '/school/olympiad-ids', gradient: 'from-[#1559C7] to-[#2a78d6]' },
              { label: 'My Students', sub: 'Registered student list', icon: Users, href: '/school/registered-students', gradient: 'from-[#0d9f6e] to-[#1baf7a]' },
              { label: 'School Profile', sub: 'Manage school details', icon: Award, href: '/school/profile', gradient: 'from-[#4a3aa7] to-[#7a6ad6]' },
              { label: 'Event Data', sub: 'View event statistics', icon: Clock, href: '/school/registered-students', gradient: 'from-[#d98600] to-[#eda100]' },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link key={a.href + a.label} href={a.href}
                  className={`relative overflow-hidden bg-gradient-to-br ${a.gradient} rounded-xl p-4 transition-transform group hover:scale-[1.02] text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)]`}>
                  <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10" />
                  <div className="relative w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mb-2.5">
                    <Icon size={15} className="text-white" />
                  </div>
                  <ArrowRight size={13} className="absolute top-4 right-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="relative text-xs font-bold">{a.label}</p>
                  <p className="relative text-[10px] text-white/80 mt-0.5">{a.sub}</p>
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

        {/* Recent Registrations */}
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2]" style={dotTexture}>
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-500/5 to-transparent rounded-t-2xl">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-emerald-600" />
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
              stats.recentRegistrations.map((s, i) => {
                const avatarGradients = [
                  'from-[#1559C7] to-[#2a78d6]',
                  'from-[#0d9f6e] to-[#1baf7a]',
                  'from-[#4a3aa7] to-[#7a6ad6]',
                  'from-[#e34948] to-[#eb6834]',
                  'from-[#d98600] to-[#eda100]',
                ];
                return (
                  <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm`}>
                      {s.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-black truncate">{s.studentName}</p>
                        {s.username && (
                          <span className="text-[9px] font-semibold text-[#1559C7] bg-[#1559C7]/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            @{s.username}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono">{s.olympiadCode} · {s.className}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-gray-400">
                        {new Date(s.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </p>
                      <CheckCircle2 size={12} className="text-green-500 ml-auto mt-0.5" />
                    </div>
                  </div>
                );
              })
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
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              Share the Olympiad ID (roll number) with each student. They register on the Mittmee App using that ID — their profile then appears in your &quot;My Students&quot; section.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
