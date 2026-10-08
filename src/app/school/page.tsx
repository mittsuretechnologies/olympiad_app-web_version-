'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Lottie from 'lottie-react';
import {
  Contact, Users, Clock, ArrowRight, CheckCircle2,
  BookOpen, Activity, ChevronRight, School, Clapperboard, Info,
} from 'lucide-react';
import { CARD, CARD_HEADER, CARD_TITLE, STACK, avatarTint } from './ui';
import { PageHeader, StatTile, ProgressBar, Avatar } from './components';

// Mascot animation shown in the greeting card — fetched at runtime since the
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
  const r = 50;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  return (
    <svg width="124" height="124" viewBox="0 0 124 124" className="-rotate-90" aria-hidden="true">
      <circle cx="62" cy="62" r={r} fill="none" stroke="#EEF0F3" strokeWidth="11" />
      <circle
        cx="62" cy="62" r={r} fill="none"
        stroke="#1559C7"
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
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
  const dateLabel = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

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
      <PageHeader title="Dashboard" />

      {/* Greeting card — the one dark surface on the page, set apart from the
          metric cards below it so the eye has a clear entry point. */}
      <div className="relative overflow-hidden rounded-lg bg-[#0B1B33] px-4 py-3 sm:px-5 sm:py-3.5">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '18px 18px' }}
        />
        <MascotAnimation className="pointer-events-none absolute bottom-0 right-4 hidden h-24 w-24 opacity-90 sm:block" />
        <div className="relative">
          <p className="text-[12px] font-medium text-white/55">{greeting} · {dateLabel}</p>
          <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.015em] text-white">
            {schoolName || 'Welcome back'}
          </h2>
          {!loading && stats && (
            <p className="mt-1.5 max-w-lg text-[13px] text-white/70">
              {stats.totalRegistered} of {stats.totalAllocated} allocated IDs registered
              {stats.totalPending > 0 && ` · ${stats.totalPending} still pending`}
            </p>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(t => (
          <Link key={t.label} href={t.href} className="rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25">
            <StatTile label={t.label} value={t.value} icon={t.icon} hint={t.hint} loading={loading} />
          </Link>
        ))}
      </div>

      {/* Rate + class breakdown + recent activity, all above the fold on a
          1440×900 screen. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">

        {/* Registration rate */}
        <div className={`${CARD} xl:col-span-3 flex flex-col items-center justify-center px-4 py-3.5`}>
          <p className="text-[12px] font-medium text-[#677285]">Registration rate</p>
          <div className="relative mt-3">
            <RingChart rate={stats?.registrationRate ?? 0} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {loading ? (
                <div className="h-7 w-12 animate-pulse rounded-md bg-[#EEF0F3]" />
              ) : (
                <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#0B1B33]">
                  {stats?.registrationRate ?? 0}%
                </span>
              )}
            </div>
          </div>
          <div className="mt-4 flex w-full items-center justify-center gap-4 text-[12px]">
            <span className="flex items-center gap-1.5 text-[#677285]">
              <CheckCircle2 size={13} className="text-[#1D7A3A]" />
              <span className="font-semibold tabular-nums text-[#0F1B2D]">{stats?.totalRegistered ?? 0}</span> done
            </span>
            <span className="flex items-center gap-1.5 text-[#677285]">
              <Clock size={13} className="text-[#A1530A]" />
              <span className="font-semibold tabular-nums text-[#0F1B2D]">{stats?.totalPending ?? 0}</span> pending
            </span>
          </div>
        </div>

        {/* Class-wise progress */}
        <div className={`${CARD} xl:col-span-5 flex flex-col`}>
          <div className={CARD_HEADER}>
            <BookOpen size={15} strokeWidth={1.75} className="text-[#677285]" />
            <h2 className={CARD_TITLE}>Class-wise progress</h2>
          </div>
          <div className="flex-1 space-y-3 p-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-24 animate-pulse rounded bg-[#EEF0F3]" />
                  <div className="h-2 w-full animate-pulse rounded-full bg-[#EEF0F3]" />
                </div>
              ))
            ) : !stats?.classwiseBreakdown?.length ? (
              <p className="py-6 text-center text-[12.5px] text-[#677285]">No class data yet.</p>
            ) : (
              stats.classwiseBreakdown.map(cls => (
                <div key={cls.classCode}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12.5px] font-medium text-[#0F1B2D]">{cls.className}</span>
                    <span className="flex-shrink-0 text-[12px] tabular-nums text-[#677285]">
                      {cls.registered}/{cls.allocated}
                      <span className="ml-1.5 font-semibold text-[#0F1B2D]">{cls.rate}%</span>
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
              <Activity size={15} strokeWidth={1.75} className="text-[#677285]" />
              <h2 className={CARD_TITLE}>Recent registrations</h2>
            </div>
          </div>
          <div className="flex-1 divide-y divide-[#EEF0F3]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-[#EEF0F3]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-28 animate-pulse rounded bg-[#EEF0F3]" />
                    <div className="h-2 w-16 animate-pulse rounded bg-[#EEF0F3]" />
                  </div>
                </div>
              ))
            ) : !stats?.recentRegistrations?.length ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-[#677285]">
                No student registrations yet.
              </p>
            ) : (
              stats.recentRegistrations.slice(0, 6).map((s, i) => (
                <div key={`${s.olympiadCode}-${i}`} className="flex items-center gap-2.5 px-4 py-2.5">
                  <Avatar name={s.studentName} tint={avatarTint(i)} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-[#0F1B2D]">{s.studentName}</p>
                    <p className="truncate font-mono text-[11px] text-[#677285]">
                      {s.olympiadCode} · {s.className}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-[11px] text-[#677285]">
                    {new Date(s.registeredAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              ))
            )}
          </div>
          {stats?.recentRegistrations?.length ? (
            <Link
              href="/school/registered-students"
              className="flex items-center justify-center gap-1 border-t border-[#EEF0F3] px-4 py-2.5 text-[12.5px] font-medium text-[#1559C7] transition-colors hover:bg-[#F6F8FC]"
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
            <ArrowRight size={15} strokeWidth={1.75} className="text-[#677285]" />
            <h2 className={CARD_TITLE}>Quick actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-3 lg:grid-cols-4">
            {quickActions.map(a => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group rounded-lg border border-[#E6E8EC] p-3.5 transition-colors hover:border-[#1559C7]/35 hover:bg-[#F7FAFF] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF3FC] text-[#1559C7] transition-colors group-hover:bg-[#1559C7] group-hover:text-white">
                    <Icon size={16} strokeWidth={1.75} />
                  </span>
                  <p className="mt-2.5 text-[12.5px] font-semibold text-[#0F1B2D]">{a.label}</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-[#677285]">{a.sub}</p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className={`${CARD} xl:col-span-4 flex items-start gap-3 p-4`}>
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#EEF3FC]">
            <Info size={15} strokeWidth={1.75} className="text-[#1559C7]" />
          </span>
          <div>
            <p className="text-[12.5px] font-semibold text-[#0F1B2D]">How it works</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#475265]">
              Share the Olympiad ID (roll number) with each student. They register on the
              Mittmee App using that ID — their profile then appears under My Students.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
