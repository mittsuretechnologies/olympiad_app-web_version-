'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Lottie from 'lottie-react';
import {
  Contact, Users, Clock, ArrowRight, CheckCircle2,
  BookOpen, Activity, ChevronRight, School, Clapperboard, Info,
} from 'lucide-react';
import { CARD, CARD_HEADER, CARD_TITLE, STACK, avatarTint } from './ui';
import { StatTile, ProgressBar, Avatar } from './components';

// Mascot animation shown in the greeting strip — fetched at runtime since the
// source file lives in /public with spaces/capitals in its name.
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

/** Completion ring for the overall registration rate. */
function RingChart({ rate }: { rate: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" className="rotate-[-90deg]" aria-hidden="true">
      <circle cx="64" cy="64" r={r} fill="none" stroke="#EDF0F4" strokeWidth="10" />
      <circle
        cx="64" cy="64" r={r} fill="none"
        stroke="#1559C7"
        strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 800ms ease' }}
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
    now.getHours() < 12 ? 'Good morning' :
    now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  const tiles = [
    { label: 'Allocated IDs',   value: stats?.totalAllocated ?? 0,  icon: Contact,        href: '/school/olympiad-ids',        hint: 'Total roll numbers issued' },
    { label: 'Registered',      value: stats?.totalRegistered ?? 0, icon: CheckCircle2, href: '/school/registered-students', hint: `${stats?.registrationRate ?? 0}% of allocated` },
    { label: 'Pending',         value: stats?.totalPending ?? 0,    icon: Clock,       href: '/school/olympiad-ids',        hint: 'Awaiting student sign-up' },
    { label: 'Classes',         value: stats?.classwiseBreakdown?.length ?? 0, icon: BookOpen, href: '/school/olympiad-ids', hint: 'With allocated IDs' },
  ];

  const quickActions = [
    { label: 'Olympiad IDs',    sub: 'Allot & manage roll numbers', icon: Contact,       href: '/school/olympiad-ids' },
    { label: 'My Students',     sub: 'Registered student list',     icon: Users,      href: '/school/registered-students' },
    { label: 'Student Videos',  sub: 'Review submissions',          icon: Clapperboard, href: '/school/student-videos' },
    { label: 'School Profile',  sub: 'Your school details',         icon: School,       href: '/school/profile' },
  ];

  return (
    <div className={STACK}>

      {/* Greeting strip — the one warm surface on the page. Kept to a single
          band so the metrics below start high on the first screen. */}
      <div className="relative overflow-hidden rounded-lg bg-[#0E2A5C] px-4 py-3 sm:px-5">
        <MascotAnimation className="pointer-events-none absolute bottom-0 right-3 hidden h-20 w-20 opacity-90 sm:block" />
        <p className="text-[11.5px] font-medium text-white/60">{greeting}</p>
        <h1 className="mt-0.5 text-[18px] font-semibold tracking-[-0.01em] text-white">
          {schoolName || 'Welcome back'}
        </h1>
        {!loading && stats && (
          <p className="mt-1 max-w-lg text-[12.5px] text-white/65">
            {stats.totalRegistered} of {stats.totalAllocated} allocated IDs registered
            {stats.totalPending > 0 && ` · ${stats.totalPending} still pending`}
          </p>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(t => (
          <Link key={t.label} href={t.href} className="rounded-lg transition-shadow hover:shadow-[0_2px_8px_rgba(16,24,40,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1559C7]/40">
            <StatTile label={t.label} value={t.value} icon={t.icon} hint={t.hint} loading={loading} />
          </Link>
        ))}
      </div>

      {/* Rate + class breakdown + recent activity, all above the fold on a
          1440×900 screen. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">

        {/* Registration rate */}
        <div className={`${CARD} xl:col-span-3 flex flex-col items-center justify-center px-4 py-4`}>
          <p className="text-[11.5px] font-medium text-[#6B7280]">Registration rate</p>
          <div className="relative mt-2">
            <RingChart rate={stats?.registrationRate ?? 0} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {loading ? (
                <div className="h-7 w-12 animate-pulse rounded bg-[#F1F3F6]" />
              ) : (
                <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-[#111827]">
                  {stats?.registrationRate ?? 0}%
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 flex w-full items-center justify-center gap-4 text-[12px]">
            <span className="flex items-center gap-1.5 text-[#6B7280]">
              <CheckCircle2 size={12} className="text-[#047857]" />
              <span className="font-semibold text-[#111827]">{stats?.totalRegistered ?? 0}</span> done
            </span>
            <span className="flex items-center gap-1.5 text-[#6B7280]">
              <Clock size={12} className="text-[#B45309]" />
              <span className="font-semibold text-[#111827]">{stats?.totalPending ?? 0}</span> pending
            </span>
          </div>
        </div>

        {/* Class-wise progress */}
        <div className={`${CARD} xl:col-span-5 flex flex-col`}>
          <div className={CARD_HEADER}>
            <BookOpen size={14} className="text-[#6B7280]" />
            <h2 className={CARD_TITLE}>Class-wise progress</h2>
          </div>
          <div className="flex-1 space-y-2.5 p-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-24 animate-pulse rounded bg-[#F1F3F6]" />
                  <div className="h-1.5 w-full animate-pulse rounded-full bg-[#F1F3F6]" />
                </div>
              ))
            ) : !stats?.classwiseBreakdown?.length ? (
              <p className="py-6 text-center text-[12.5px] text-[#6B7280]">No class data yet.</p>
            ) : (
              stats.classwiseBreakdown.map(cls => (
                <div key={cls.classCode}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-medium text-[#111827]">{cls.className}</span>
                    <span className="flex-shrink-0 text-[12px] text-[#6B7280]">
                      {cls.registered}/{cls.allocated}
                      <span className="ml-1.5 font-semibold text-[#111827]">{cls.rate}%</span>
                    </span>
                  </div>
                  <ProgressBar value={cls.rate} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent registrations */}
        <div className={`${CARD} xl:col-span-4 flex flex-col`}>
          <div className={`${CARD_HEADER} justify-between`}>
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[#6B7280]" />
              <h2 className={CARD_TITLE}>Recent registrations</h2>
            </div>
          </div>
          <div className="flex-1 divide-y divide-[#F1F3F6]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-2">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-[#F1F3F6]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-28 animate-pulse rounded bg-[#F1F3F6]" />
                    <div className="h-2 w-16 animate-pulse rounded bg-[#F1F3F6]" />
                  </div>
                </div>
              ))
            ) : !stats?.recentRegistrations?.length ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-[#6B7280]">
                No student registrations yet.
              </p>
            ) : (
              stats.recentRegistrations.slice(0, 6).map((s, i) => (
                <div key={`${s.olympiadCode}-${i}`} className="flex items-center gap-2.5 px-4 py-2">
                  <Avatar name={s.studentName} tint={avatarTint(i)} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-[#111827]">{s.studentName}</p>
                    <p className="truncate font-mono text-[11px] text-[#6B7280]">
                      {s.olympiadCode} · {s.className}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[11px] text-[#6B7280]">
                    {new Date(s.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              ))
            )}
          </div>
          {stats?.recentRegistrations?.length ? (
            <Link
              href="/school/registered-students"
              className="flex items-center justify-center gap-1 border-t border-[#E4E8EE] px-4 py-2 text-[12px] font-medium text-[#1559C7] transition-colors hover:bg-[#1559C7]/[0.04]"
            >
              View all students <ChevronRight size={13} />
            </Link>
          ) : null}
        </div>
      </div>

      {/* Quick actions + how it works */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className={`${CARD} xl:col-span-8`}>
          <div className={CARD_HEADER}>
            <ArrowRight size={14} className="text-[#6B7280]" />
            <h2 className={CARD_TITLE}>Quick actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 lg:grid-cols-4">
            {quickActions.map(a => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group rounded-lg border border-[#E4E8EE] p-3 transition-colors hover:border-[#1559C7]/40 hover:bg-[#1559C7]/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1559C7]/40"
                >
                  <Icon size={16} className="text-[#1559C7]" strokeWidth={2} />
                  <p className="mt-2 text-[12.5px] font-semibold text-[#111827]">{a.label}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[#6B7280]">{a.sub}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className={`${CARD} xl:col-span-4 flex items-start gap-2.5 p-4`}>
          <Info size={15} className="mt-0.5 flex-shrink-0 text-[#1559C7]" />
          <div>
            <p className="text-[12.5px] font-semibold text-[#111827]">How it works</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#4B5563]">
              Share the Olympiad ID (roll number) with each student. They register on the
              Mittmee App using that ID — their profile then appears under My Students.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
