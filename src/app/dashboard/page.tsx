'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  School, Hash, Users, AlertCircle, UploadCloud, Smartphone,
  Clock, CheckCircle2, XCircle, ArrowRight, BookOpen, Activity,
  PlaySquare, ChevronRight, KeyRound, BarChart2, Star, Loader2,
  Download, Calendar, Check, ShieldCheck,
} from 'lucide-react';
import { tokenRole } from '@/lib/session-token';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import Lottie from 'lottie-react';

interface Overview {
  stats: {
    totalSchools: number;
    activeSchools: number;
    totalAllocatedIds: number;
    totalRegisteredStudents: number;
    totalPendingRegistrations: number;
    registrationRate: number;
    schoolsWithRegistrations: number;
    registeredLoggedIn: number;
    registeredNotLoggedIn: number;
    totalMappedIds: number;
    schoolsMapping: number;
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
  monthlyTrend: { month: string; schools: number; schoolStudents: number; appUsers: number }[];
}

interface EvaluatorStats {
  stats: {
    totalEvaluated: number;
    averageScore: number;
    pendingQueue: number;
  };
  criteriaAvg: {
    coordinationScore: number;
    memoryEnergyScore: number;
    imaginationEmotionScore: number;
    focusLanguageScore: number;
    creativityJoyScore: number;
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

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-lg px-4 py-3 min-w-[180px]">
      <p className="text-sm font-semibold text-slate-500 border-b border-slate-100 pb-2 mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              {p.name}:
            </span>
            <span className="font-bold text-slate-900">{p.value.toLocaleString('en-IN')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mascot animation above the Download Report button — fetched at runtime
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

// Sub-metric pill riding under a KPI tile, e.g. "Active : 4579".
function StatPill({ label, value, tone }: { label: string; value: number | string; tone: 'default' | 'good' | 'warning' }) {
  const toneClass = tone === 'good'
    ? 'bg-emerald-50 text-emerald-700'
    : tone === 'warning'
    ? 'bg-orange-50 text-orange-600'
    : 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${toneClass}`}>
      {label} : <span className="font-bold">{value.toLocaleString('en-IN')}</span>
    </span>
  );
}

// Fixed categorical rotation for card backgrounds — same order every render,
// never re-cycled based on filtered data, so a tile's color stays its identity.
const CARD_TINTS = ['bg-blue-50/70', 'bg-teal-50/70', 'bg-amber-50/70', 'bg-violet-50/70', 'bg-rose-50/70', 'bg-orange-50/70'];

function KpiTile({
  label, icon: Icon, value, loading, pills, tint,
}: {
  label: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  value: number;
  loading: boolean;
  pills: { label: string; value: number | string; tone: 'default' | 'good' | 'warning' }[];
  href: string;
  tint: string;
}) {
  return (
    <div
      className={`card-body dashcard relative rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 ${tint}`}
      style={{ width: '100%', height: 160, padding: '16px', fontFamily: 'var(--font-poppins), Poppins, sans-serif', color: '#212529' }}
    >
      <h3 className="text-[15px] font-semibold leading-snug">{label}</h3>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white shadow-sm">
          <Icon size={18} className="text-red-600" />
        </div>
        {loading ? (
          <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-lg" />
        ) : (
          <p className="text-2xl leading-none font-bold text-[#052E5C] tabular-nums">{value.toLocaleString('en-IN')}</p>
        )}
      </div>
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-auto pt-1">
          {pills.map(p => <StatPill key={p.label} {...p} />)}
        </div>
      )}
    </div>
  );
}

// yyyy-mm-dd, in local time (not UTC) so "Today" always means the viewer's today.
function toISODate(d: Date) {
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().split('T')[0];
}

type DateRange = { from: string; to: string; label: string } | null;

function buildPreset(label: string, daysAgoFrom: number, daysAgoTo = 0): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysAgoFrom);
  to.setDate(to.getDate() - daysAgoTo);
  return { from: toISODate(from), to: toISODate(to), label };
}

function DateRangeFilter({ value, onApply }: { value: DateRange; onApply: (range: DateRange) => void }) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const presets: { label: string; range: () => DateRange }[] = [
    { label: 'Today', range: () => buildPreset('Today', 0) },
    { label: 'Yesterday', range: () => buildPreset('Yesterday', 1, 1) },
    { label: 'Last 7 Days', range: () => buildPreset('Last 7 Days', 6) },
    { label: 'Last 30 Days', range: () => buildPreset('Last 30 Days', 29) },
    { label: 'This Week', range: () => {
      const now = new Date(); const day = now.getDay();
      const from = new Date(now); from.setDate(now.getDate() - day);
      return { from: toISODate(from), to: toISODate(now), label: 'This Week' };
    } },
    { label: 'Last Week', range: () => {
      const now = new Date(); const day = now.getDay();
      const to = new Date(now); to.setDate(now.getDate() - day - 1);
      const from = new Date(to); from.setDate(to.getDate() - 6);
      return { from: toISODate(from), to: toISODate(to), label: 'Last Week' };
    } },
    { label: 'This Month', range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toISODate(from), to: toISODate(now), label: 'This Month' };
    } },
    { label: 'Last Month', range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toISODate(from), to: toISODate(to), label: 'Last Month' };
    } },
    { label: 'Last 12 Months', range: () => buildPreset('Last 12 Months', 365) },
    { label: 'Year to Date', range: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: toISODate(from), to: toISODate(now), label: 'Year to Date' };
    } },
  ];

  const applyPreset = (range: DateRange) => { onApply(range); setOpen(false); };

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    onApply({ from: customFrom, to: customTo, label: `${customFrom} to ${customTo}` });
    setOpen(false);
  };

  const clear = () => { onApply(null); setCustomFrom(''); setCustomTo(''); setOpen(false); };

  return (
    <div ref={rootRef} className="relative w-72">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-left shadow-sm hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-[#052E5C]/20 focus:border-[#052E5C]"
      >
        <Calendar size={15} className="text-slate-400 flex-shrink-0" />
        <span className={value ? 'text-slate-700 font-medium' : 'text-slate-400'}>
          {value ? value.label : 'Filter by date range'}
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-64 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          <div className="py-1.5 max-h-80 overflow-y-auto">
            {presets.map(p => {
              const isSelected = value?.label === p.label;
              return (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.range())}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors ${
                    isSelected ? 'bg-[#052E5C] text-white font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                  {isSelected && <Check size={16} strokeWidth={3} />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-200 p-3 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Custom Range</p>
            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-[#052E5C]" />
              <span className="text-slate-300 text-xs">–</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 outline-none focus:border-[#052E5C]" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={applyCustom} disabled={!customFrom || !customTo}
                className="flex-1 px-3 py-1.5 rounded-md bg-[#052E5C] text-white text-xs font-bold hover:bg-[#063a72] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Apply
              </button>
              {value && (
                <button onClick={clear}
                  className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-500 text-xs font-bold hover:bg-slate-200 transition-colors">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// "Super Admin" / "Master Admin" pill next to the page title — both roles
// sign in under the same 'token' key, so this reads the role claim from it.
function AdminRoleBadge() {
  const [info, setInfo] = useState<{ role: string; name: string } | null>(null);
  useEffect(() => {
    const role = tokenRole(sessionStorage.getItem('token'));
    let name = '';
    try { name = JSON.parse(sessionStorage.getItem('adminUser') || '{}').name || ''; } catch { /* ignore */ }
    if (role === 'SUPERADMIN' || role === 'MASTER_ADMIN') setInfo({ role, name });
  }, []);
  if (!info) return null;
  const isMaster = info.role === 'MASTER_ADMIN';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${isMaster ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-[#004f9f]/5 border-[#004f9f]/20 text-[#004f9f]'}`}>
      <ShieldCheck size={13} />
      {isMaster ? 'Master Admin' : 'Super Admin'}
      {info.name && <span className="font-medium opacity-80">· {info.name}</span>}
    </span>
  );
}

const PANEL_FONT = { fontFamily: 'var(--font-poppins), Poppins, sans-serif', color: '#212529' } as const;

// Shared shell for every panel below the KPI tiles — same radius, border,
// font and header treatment as the KPI cards so the page reads as one system.
function Panel({
  title, subtitle, icon: Icon, action, className = '', children,
}: {
  title: string;
  subtitle?: string;
  icon: any;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden ${className}`} style={PANEL_FONT}>
      <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
            <Icon size={17} className="text-red-600" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-tight truncate">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#004f9f] hover:bg-[#004f9f]/5 transition-colors">
      {children} <ArrowRight size={12} />
    </Link>
  );
}

function Chip({ tone, children }: { tone: 'good' | 'warning' | 'bad' | 'default'; children: React.ReactNode }) {
  const cls = tone === 'good' ? 'bg-emerald-50 text-emerald-700'
    : tone === 'warning' ? 'bg-orange-50 text-orange-600'
    : tone === 'bad' ? 'bg-red-50 text-red-600'
    : 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}

function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-100 rounded-full animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 bg-slate-100 animate-pulse rounded" />
            <div className="h-2.5 w-24 bg-slate-100 animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="px-5 py-10 flex flex-col items-center gap-2 text-slate-400">
      <Icon size={26} strokeWidth={1.5} />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

// Rotating header colours for upcoming dates so each day reads as its own block.
const EXAM_DATE_TONES = [
  'bg-blue-50 text-blue-800 border-blue-100',
  'bg-violet-50 text-violet-800 border-violet-100',
  'bg-amber-50 text-amber-800 border-amber-100',
  'bg-rose-50 text-rose-800 border-rose-100',
  'bg-teal-50 text-teal-800 border-teal-100',
];

// Schools sitting their exam today, followed by upcoming exam dates in order.
function ExamScheduleCard() {
  const [schools, setSchools] = useState<{ id: string; name: string; schoolId: string; city: string | null; state: string | null; examDate: string }[]>([]);
  const [today, setToday] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token') || '';
    fetch('/api/dashboard/exam-schedule', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setSchools(d.schools); setToday(d.today); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const todayCount = schools.filter(s => s.examDate === today).length;
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  // Group by date; the API already returns them soonest-first.
  const groups: { date: string; items: typeof schools }[] = [];
  for (const sc of schools) {
    const last = groups[groups.length - 1];
    if (last && last.date === sc.examDate) last.items.push(sc);
    else groups.push({ date: sc.examDate, items: [sc] });
  }

  return (
    <Panel
      title="Exam Schedule"
      subtitle="Today first, then upcoming dates"
      icon={Calendar}
      action={!loading && (<><Chip tone="good">Today : {todayCount}</Chip><Chip tone="default">Upcoming : {schools.length - todayCount}</Chip></>)}
    >
      <div className="max-h-[380px] overflow-y-auto">
        {loading ? <SkeletonRows n={3} /> : !groups.length ? (
          <EmptyState icon={Calendar} text="No exams scheduled for today or later." />
        ) : (
          groups.map((g, gi) => {
            const isToday = g.date === today;
            const tone = isToday ? 'bg-green-600 text-white border-green-700' : EXAM_DATE_TONES[gi % EXAM_DATE_TONES.length];
            return (
              <div key={g.date}>
                <div className={`sticky top-0 z-10 px-5 py-2 text-[11px] font-bold uppercase tracking-wider flex items-center justify-between border-y first:border-t-0 ${tone}`}>
                  <span>{isToday ? `Today · ${fmt(g.date)}` : fmt(g.date)}</span>
                  <span>{g.items.length} {g.items.length === 1 ? 'school' : 'schools'}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {g.items.map(sc => (
                    <Link key={sc.id} href="/dashboard/schools" className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {sc.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{sc.name}</p>
                        <p className="text-xs text-slate-500 truncate">{sc.schoolId}{sc.city ? ` · ${sc.city}` : ''}{sc.state ? `, ${sc.state}` : ''}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}

// Today's exam schools and whether each has sent its attendance report.
function TodayAttendanceCard() {
  const [schools, setSchools] = useState<{ id: string; name: string; schoolId: string; city: string | null; state: string | null; submittedAt: string | null; present: number; absent: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token') || '';
    fetch('/api/dashboard/today-attendance', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setSchools(d.schools); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sent = schools.filter(s => s.submittedAt).length;

  return (
    <Panel
      title="Today's Attendance Reports"
      subtitle="Schools with an exam today"
      icon={CheckCircle2}
      action={!loading && (<><Chip tone="good">Sent : {sent}</Chip><Chip tone="warning">Pending : {schools.length - sent}</Chip></>)}
    >
      <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
        {loading ? <SkeletonRows n={3} /> : !schools.length ? (
          <EmptyState icon={CheckCircle2} text="No school has its exam today." />
        ) : (
          schools.map(sc => (
            <Link key={sc.id} href="/dashboard/schools/attendance" className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${sc.submittedAt ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'}`}>
                {sc.submittedAt ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{sc.name}</p>
                <p className="text-xs text-slate-500 truncate">{sc.schoolId}{sc.city ? ` · ${sc.city}` : ''}{sc.state ? `, ${sc.state}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <Chip tone={sc.submittedAt ? 'good' : 'warning'}>{sc.submittedAt ? 'Report sent' : 'Not sent yet'}</Chip>
                <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  {sc.submittedAt ? `${new Date(sc.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · ` : ''}
                  P {sc.present} · A {sc.absent}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
      {!loading && schools.length > 0 && (
        <footer className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/60 text-right">
          <PanelLink href="/dashboard/schools/attendance">View all attendance reports</PanelLink>
        </footer>
      )}
    </Panel>
  );
}

function SuperAdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [appliedRange, setAppliedRange] = useState<DateRange>(null);
  // A Master Admin without the Dashboard Overview module gets a 403 here.
  const [forbidden, setForbidden] = useState(false);

  const fetchOverview = (range: DateRange) => {
    setLoading(true);
    const qs = range ? `?from=${range.from}&to=${range.to}` : '';
    const token = sessionStorage.getItem('token') || '';
    fetch(`/api/dashboard/overview${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 403) { setForbidden(true); return null; }
        return r.json();
      })
      .then(d => { if (d) setData(d); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOverview(null); }, []);

  const handleRangeChange = (range: DateRange) => {
    setAppliedRange(range);
    fetchOverview(range);
  };

  const s = data?.stats;

  const downloadReport = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Schools', s?.totalSchools ?? 0],
      ['Active Schools', s?.activeSchools ?? 0],
      ['Allocated IDs', s?.totalAllocatedIds ?? 0],
      ['Registered Students', s?.totalRegisteredStudents ?? 0],
      ['Pending Registrations', s?.totalPendingRegistrations ?? 0],
      ['Registration Rate %', s?.registrationRate ?? 0],
      ['Schools With Registrations', s?.schoolsWithRegistrations ?? 0],
      ['Registered - Logged In On App', s?.registeredLoggedIn ?? 0],
      ['Registered - Not Logged In Yet', s?.registeredNotLoggedIn ?? 0],
      ['IDs Mapped To Students By Schools', s?.totalMappedIds ?? 0],
      ['Schools That Mapped IDs', s?.schoolsMapping ?? 0],
      ['Uploaders', s?.totalUploaders ?? 0],
      ['App Users', s?.totalAppUsers ?? 0],
      ['Pending Videos', s?.pendingVideos ?? 0],
      ['Approved Videos', s?.approvedVideos ?? 0],
      ['Rejected Videos', s?.rejectedVideos ?? 0],
    ];
    const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const suffix = appliedRange ? `${appliedRange.from}_to_${appliedRange.to}` : new Date().toISOString().split('T')[0];
    a.href = url; a.download = `dashboard-report-${suffix}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const kpiTiles = useMemo(() => [
    {
      label: 'Total Schools', icon: School, iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
      value: s?.totalSchools ?? 0, href: '/dashboard/schools',
      pills: [
        { label: 'Active', value: s?.activeSchools ?? 0, tone: 'good' as const },
        { label: 'Inactive', value: (s?.totalSchools ?? 0) - (s?.activeSchools ?? 0), tone: 'warning' as const },
        { label: 'Mapping started', value: s?.schoolsMapping ?? 0, tone: 'default' as const },
      ],
    },
    {
      label: 'Allocated IDs', icon: Hash, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600',
      value: s?.totalAllocatedIds ?? 0, href: '/dashboard/credentials/students',
      pills: [
        { label: 'Mapped by schools', value: s?.totalMappedIds ?? 0, tone: 'good' as const },
        { label: 'Unmapped', value: Math.max((s?.totalAllocatedIds ?? 0) - (s?.totalMappedIds ?? 0), 0), tone: 'warning' as const },
      ],
    },
    {
      label: 'Registered Students', icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
      value: s?.totalRegisteredStudents ?? 0, href: '/dashboard/credentials/registered-students',
      pills: [
        { label: 'Logged in on app', value: s?.registeredLoggedIn ?? 0, tone: 'good' as const },
        { label: 'Not logged in', value: s?.registeredNotLoggedIn ?? 0, tone: 'warning' as const },
        { label: 'Reg. rate', value: `${s?.registrationRate ?? 0}%`, tone: 'default' as const },
        { label: 'Schools', value: s?.schoolsWithRegistrations ?? 0, tone: 'default' as const },
      ],
    },
    {
      label: 'Uploaders', icon: UploadCloud, iconBg: 'bg-purple-50', iconColor: 'text-purple-600',
      value: s?.totalUploaders ?? 0, href: '/dashboard/uploaders', pills: [],
    },
    {
      label: 'App Users', icon: Smartphone, iconBg: 'bg-teal-50', iconColor: 'text-teal-600',
      value: s?.totalAppUsers ?? 0, href: '/dashboard/app-users', pills: [],
    },
    {
      label: 'Video Submissions', icon: PlaySquare, iconBg: 'bg-rose-50', iconColor: 'text-rose-600',
      value: (s?.pendingVideos ?? 0) + (s?.approvedVideos ?? 0) + (s?.rejectedVideos ?? 0), href: '/dashboard/videos',
      pills: [
        { label: 'Approved', value: s?.approvedVideos ?? 0, tone: 'good' as const },
        { label: 'Pending', value: s?.pendingVideos ?? 0, tone: 'warning' as const },
      ],
    },
  ], [s]);

  const moderationCards = [
    { label: 'Pending', value: s?.pendingVideos ?? 0, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Approved', value: s?.approvedVideos ?? 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Rejected', value: s?.rejectedVideos ?? 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  // Round the Y-axis to clean steps (0/100/300/600/1200-style) instead of
  // whatever fractional ticks the raw data max would otherwise produce.
  const trendTicks = useMemo(() => {
    const trend = data?.monthlyTrend ?? [];
    const max = trend.reduce((m, r) => Math.max(m, r.schools, r.schoolStudents, r.appUsers), 0);
    const niceMax = max <= 0 ? 4 : Math.pow(10, Math.floor(Math.log10(max))) * (
      max / Math.pow(10, Math.floor(Math.log10(max))) <= 2 ? 2 : max / Math.pow(10, Math.floor(Math.log10(max))) <= 5 ? 5 : 10
    );
    const step = niceMax / 4;
    return Array.from({ length: 5 }, (_, i) => Math.round(step * i));
  }, [data]);


  if (forbidden) {
    let name = '';
    try { name = JSON.parse(sessionStorage.getItem('adminUser') || '{}').name || ''; } catch { /* ignore */ }
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-medium text-[#004f9f]">Welcome{name ? `, ${name}` : ''}</h1>
        <div className="mt-3"><AdminRoleBadge /></div>
        <p className="text-sm text-gray-500 mt-2">Use the menu on the left to open the sections you have access to.</p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-medium text-[#004f9f]">Dashboard</h1>
        <AdminRoleBadge />
      </div>

      {/* Filter bar: date range + download report */}
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <MascotAnimation className="absolute bottom-full mb-[-3px] w-24 h-24 pointer-events-none mascot-walk-in" />
        <DateRangeFilter value={appliedRange} onApply={handleRangeChange} />
        <button onClick={downloadReport}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#052E5C] text-white text-sm font-semibold hover:bg-[#063a72] transition-colors shadow-sm relative top-[3px]">
          <Download size={15} /> Download Report
        </button>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-[30px]">
        {kpiTiles.map((tile, i) => <KpiTile key={tile.label} {...tile} loading={loading} tint={CARD_TINTS[i % CARD_TINTS.length]} />)}
      </div>

      {/* Current Year Monthly Reports */}
      <Panel title="Current Year Monthly Reports" subtitle={`Schools, students and app users registered per month in ${new Date().getFullYear()}`} icon={Activity}>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data?.monthlyTrend ?? []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#eef0f3" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#898781' }} axisLine={{ stroke: '#d9dce1' }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#898781' }} axisLine={false} tickLine={false} ticks={trendTicks} domain={[0, trendTicks[trendTicks.length - 1]]} />
              <Tooltip content={<TrendTooltip />} />
              <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} iconType="circle" />
              <Line type="monotone" dataKey="schools" name="Schools" stroke="#2a78d6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="schoolStudents" name="School Students" stroke="#1baf7a" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="appUsers" name="App Users" stroke="#eb6834" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Exam schedule + today's attendance reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ExamScheduleCard />
        <TodayAttendanceCard />
      </div>

      {/* Video Moderation Summary */}
      <Panel title="Video Moderation" subtitle="Status of all submitted videos" icon={PlaySquare} action={<PanelLink href="/dashboard/videos">Review now</PanelLink>}>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {moderationCards.map(m => {
            const Icon = m.icon;
            return (
              <div key={m.label} className={`${m.bg} rounded-xl border border-slate-200 px-4 py-3.5 flex items-center gap-3`}>
                <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                  <Icon size={17} className={m.color} />
                </div>
                <div>
                  {loading ? (
                    <div className="h-6 w-10 bg-white/70 animate-pulse rounded" />
                  ) : (
                    <p className="text-2xl leading-none font-bold text-[#052E5C] tabular-nums">{m.value.toLocaleString('en-IN')}</p>
                  )}
                  <p className="text-xs font-medium text-slate-600 mt-1">{m.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top Schools */}
        <Panel className="lg:col-span-2" title="Top Schools by Registrations" subtitle="Registered students vs allocated IDs" icon={BarChart2} action={<PanelLink href="/dashboard/schools">All schools</PanelLink>}>
          <div className="px-5 py-4 space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-40 bg-slate-100 animate-pulse rounded" />
                  <div className="h-2 w-full bg-slate-100 animate-pulse rounded-full" />
                </div>
              ))
            ) : !data?.topSchools?.length ? (
              <EmptyState icon={BarChart2} text="No school data available yet." />
            ) : (
              data.topSchools.map((school, i) => {
                const bar = school.rate === 100 ? 'bg-emerald-500' : school.rate >= 50 ? 'bg-blue-500' : 'bg-orange-400';
                return (
                  <div key={school.id} className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3 mb-1.5">
                        <p className="text-sm font-semibold truncate">{school.name}</p>
                        <p className="text-xs text-slate-500 flex-shrink-0 tabular-nums">{school.registered.toLocaleString('en-IN')} / {school.allocated.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${bar}`} style={{ width: `${school.rate}%` }} />
                      </div>
                    </div>
                    <Chip tone={school.rate === 100 ? 'good' : school.rate >= 50 ? 'default' : 'warning'}>{school.rate}%</Chip>
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        {/* Quick Actions */}
        <Panel title="Quick Actions" subtitle="Jump to common tasks" icon={KeyRound}>
          <div className="p-4 grid grid-cols-2 gap-3">
            {[
              { label: 'Register School', icon: School, href: '/dashboard/schools/register', tint: 'bg-blue-50/70' },
              { label: 'Moderation', icon: PlaySquare, href: '/dashboard/videos', tint: 'bg-rose-50/70' },
              { label: 'Credentials', icon: KeyRound, href: '/dashboard/credentials/schools', tint: 'bg-amber-50/70' },
              { label: 'Reports', icon: BarChart2, href: '/dashboard/reports/schools', tint: 'bg-teal-50/70' },
            ].map(a => {
              const Icon = a.icon;
              return (
                <Link key={a.href} href={a.href}
                  className={`${a.tint} rounded-xl border border-slate-200 p-4 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all`}>
                  <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
                    <Icon size={17} className="text-red-600" />
                  </div>
                  <p className="text-sm font-semibold">{a.label}</p>
                </Link>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Registrations */}
        <Panel title="Recent Registrations" subtitle="Latest students to register" icon={Activity}
          action={<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}>
          {loading ? <SkeletonRows n={4} /> : !data?.recentStudents?.length ? (
            <EmptyState icon={Users} text="No registrations yet." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentStudents.map(stu => (
                <div key={stu.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-[#052E5C] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {stu.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{stu.name}</p>
                    <p className="text-xs text-slate-500 truncate">{stu.olympiadCode} · {stu.schoolName}</p>
                  </div>
                  <span className="text-xs text-slate-500 flex-shrink-0 tabular-nums">{new Date(stu.createdAt).toLocaleDateString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Recent Video Uploads */}
        <Panel title="Recent Video Uploads" subtitle="Latest submissions across all sources" icon={BookOpen} action={<PanelLink href="/dashboard/videos">View all</PanelLink>}>
          {loading ? <SkeletonRows n={4} /> : !data?.recentVideos?.length ? (
            <EmptyState icon={PlaySquare} text="No video uploads yet." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentVideos.map(v => (
                <div key={v.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    v.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                    v.status === 'REJECTED' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-500'
                  }`}>
                    <PlaySquare size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{v.studentName || v.uploaderType}</p>
                    <p className="text-xs text-slate-500 truncate">{v.caption || 'No caption'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Chip tone={v.status === 'APPROVED' ? 'good' : v.status === 'REJECTED' ? 'bad' : 'warning'}>
                      {v.status.charAt(0) + v.status.slice(1).toLowerCase()}
                    </Chip>
                    <p className="text-[11px] text-slate-500 mt-1 tabular-nums">{new Date(v.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
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
                    <p className="text-xs text-gray-400 truncate mt-0.5">{e.olympiadCode} Â· {e.category} / {e.subCategory}</p>
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
              { label: 'Coordination (Annamaya)', val: criteria?.coordinationScore ?? 0, color: 'bg-green-500' },
              { label: 'Memory and Energy (Pranamaya)', val: criteria?.memoryEnergyScore ?? 0, color: 'bg-amber-500' },
              { label: 'Imagination and Emotion (Manomaya)', val: criteria?.imaginationEmotionScore ?? 0, color: 'bg-blue-500' },
              { label: 'Focus / Language (Vijnanamaya)', val: criteria?.focusLanguageScore ?? 0, color: 'bg-purple-500' },
              { label: 'Creativity and Joyfulness (Anandamaya)', val: criteria?.creativityJoyScore ?? 0, color: 'bg-rose-500' },
            ].map(c => {
              const pct = (c.val / 4) * 100;
              return (
                <div key={c.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-gray-600 truncate mr-2">{c.label}</span>
                    <span className="font-black text-gray-800 shrink-0">{c.val}/4</span>
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
    const token = sessionStorage.getItem('reviewerToken') || '';
    fetch('/api/dashboard/overview', { headers: { Authorization: `Bearer ${token}` } })
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
  // MASTER_ADMIN shares the SuperAdmin dashboard (gated by the 'overview' module server-side).
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
