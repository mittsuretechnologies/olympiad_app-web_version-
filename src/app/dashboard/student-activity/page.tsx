'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  Clock, Loader2, Search, Download, Users, GraduationCap,
  Smartphone, Filter, X, School, Timer, Activity, TrendingUp, MapPin,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface ActivityRow {
  id: string;
  type: 'STUDENT' | 'APP_USER';
  // Olympiad = enrolled through a school (a Student row, or an AppUser that
  // carries an olympiadId). General = signed up on the app independently.
  accountKind: 'OLYMPIAD' | 'GENERAL';
  name: string;
  identifier: string | null;
  contact: string | null;
  schoolName: string | null;
  city: string | null;
  state: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

// App usage (from the app's usage tracker, /api/dashboard/student-activity/usage).
interface UsageUser { appUserId: string; sessions: number; activeSeconds: number; idleSeconds: number; lastSeen: string }
interface UsageData {
  days: number;
  from: string;
  totals: { sessions: number; users: number; accounts: number; guests: number; activeSeconds: number; idleSeconds: number };
  daily: { day: string; sessions: number; users: number; activeSeconds: number }[];
  hourly: { hour: number; sessions: number; users: number; activeSeconds: number }[];
  platforms: { platform: string; sessions: number; users: number }[];
  users: UsageUser[];
}

const RANGES: [number, string][] = [[1, 'Today'], [7, '7 days'], [30, '30 days'], [90, '90 days']];
const BRAND = '#004f9f';
const BRAND_SOFT = '#7FA6CF';

// "2 hours ago" / "5 days ago" style relative label — the whole point of this
// page is scanning who's been active recently, and an absolute timestamp
// alone makes that a mental-math exercise for every row.
function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Exact date + time, shown under the relative label. The relative form is
// what makes the list scannable, but "5d ago" is useless for the actual
// question this report gets used for — when precisely was this account last
// active — so both are shown rather than one replacing the other.
function absoluteTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// Active in the last 24h reads as a distinct "currently engaged" signal from
// the rest of the list, which is otherwise sorted but visually uniform.
function isRecentlyActive(iso: string | null): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

// 45s / 12m / 3h 20m
function fmtDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

type DailyMetric = 'users' | 'minutes' | 'sessions';
const DAILY_METRICS: [DailyMetric, string][] = [['users', 'Active users'], ['minutes', 'Time in app (min)'], ['sessions', 'Sessions']];

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 px-4 py-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{icon}{label}</p>
      <p className="text-2xl font-bold text-[#004f9f] mt-1 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label, render }: {
  active?: boolean; payload?: { payload: Record<string, number | string> }[]; label?: string | number;
  render: (p: Record<string, number | string>, label?: string | number) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-md px-3 py-2 text-xs text-gray-700">
      {render(payload[0].payload, label)}
    </div>
  );
}

export default function StudentActivityPage() {
  const { data, isLoading: loading } = useSWR<ActivityRow[]>('/api/dashboard/student-activity', fetcher);
  const rows = useMemo<ActivityRow[]>(() => (Array.isArray(data) ? data : []), [data]);

  const [days, setDays] = useState(7);
  const { data: usage, isLoading: usageLoading, error: usageError } =
    useSWR<UsageData>(`/api/dashboard/student-activity/usage?days=${days}`, fetcher);
  const [dailyMetric, setDailyMetric] = useState<DailyMetric>('users');

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterActivity, setFilterActivity] = useState('All');
  const [sortBy, setSortBy] = useState('Last active');

  const usageByUser = useMemo(
    () => new Map((usage?.users ?? []).map(u => [u.appUserId, u])),
    [usage],
  );
  const usageOf = (r: ActivityRow) => (r.type === 'APP_USER' ? usageByUser.get(r.id) : undefined);

  const activeFilterCount = (filterType !== 'All' ? 1 : 0) + (filterActivity !== 'All' ? 1 : 0) + (search ? 1 : 0);

  const clearFilters = () => {
    setFilterType('All'); setFilterActivity('All'); setSearch('');
  };

  const filtered = useMemo(() => {
    const list = rows.filter(r => {
      if (filterType === 'Olympiad User' && r.accountKind !== 'OLYMPIAD') return false;
      if (filterType === 'General User'  && r.accountKind !== 'GENERAL')  return false;
      if (filterActivity === 'Active (24h)' && !isRecentlyActive(r.lastLoginAt)) return false;
      if (filterActivity === 'Never logged in' && r.lastLoginAt) return false;
      if (filterActivity === 'Used app in range' && !(r.type === 'APP_USER' && usageByUser.has(r.id))) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(q) &&
          !(r.identifier || '').toLowerCase().includes(q) &&
          !(r.contact || '').includes(q) &&
          !(r.schoolName || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
    if (sortBy === 'Time in app') {
      const t = (r: ActivityRow) => (r.type === 'APP_USER' ? usageByUser.get(r.id)?.activeSeconds ?? -1 : -1);
      return [...list].sort((a, b) => t(b) - t(a));
    }
    if (sortBy === 'Last in app') {
      const t = (r: ActivityRow) => {
        const u = r.type === 'APP_USER' ? usageByUser.get(r.id) : undefined;
        return u ? new Date(u.lastSeen).getTime() : -1;
      };
      return [...list].sort((a, b) => t(b) - t(a));
    }
    return list;
  }, [rows, filterType, filterActivity, search, sortBy, usageByUser]);

  const olympiadCount = filtered.filter(r => r.accountKind === 'OLYMPIAD').length;
  const generalCount  = filtered.filter(r => r.accountKind === 'GENERAL').length;
  const activeNowCount = filtered.filter(r => isRecentlyActive(r.lastLoginAt)).length;

  // ── Usage summaries ──
  const totals = usage?.totals;
  const peak = useMemo(() => {
    const h = usage?.hourly ?? [];
    const best = h.reduce<UsageData['hourly'][number] | null>((m, x) => (x.users > (m?.users ?? 0) ? x : m), null);
    return best && best.users > 0 ? best : null;
  }, [usage]);
  const dailyData = useMemo(() => (usage?.daily ?? []).map(d => ({
    ...d, label: dayLabel(d.day), minutes: Math.round(d.activeSeconds / 60),
  })), [usage]);
  const hourlyData = useMemo(() => (usage?.hourly ?? []).map(h => ({ ...h, label: hourLabel(h.hour) })), [usage]);

  // Location = the account's school city/state (accounts without a school are "Unknown").
  const locations = useMemo(() => {
    const byState = new Map<string, { users: number; seconds: number }>();
    const byCity = new Map<string, { users: number; seconds: number }>();
    for (const r of rows) {
      if (r.type !== 'APP_USER') continue;
      const u = usageByUser.get(r.id);
      if (!u) continue;
      const st = r.state || 'Unknown';
      const ct = r.city ? `${r.city}${r.state ? `, ${r.state}` : ''}` : 'Unknown';
      for (const [map, key] of [[byState, st], [byCity, ct]] as const) {
        const cur = map.get(key) ?? { users: 0, seconds: 0 };
        cur.users += 1; cur.seconds += u.activeSeconds;
        map.set(key, cur);
      }
    }
    const top = (m: Map<string, { users: number; seconds: number }>) =>
      [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.seconds - a.seconds).slice(0, 8);
    return { states: top(byState), cities: top(byCity) };
  }, [rows, usageByUser]);

  const rangeLabel = RANGES.find(([d]) => d === days)?.[1] ?? `${days} days`;

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['#', 'Name', 'Account Type', 'Source', 'Identifier', 'Contact', 'School', 'City', 'State', 'Last Active',
      `Time in app (${rangeLabel}, min)`, `Sessions (${rangeLabel})`, 'Last in app', 'Registered On'];
    const csvRows = filtered.map((r, i) => {
      const u = usageOf(r);
      return [
        i + 1, r.name,
        r.accountKind === 'OLYMPIAD' ? 'Olympiad User' : 'General User',
        r.type === 'STUDENT' ? 'Student' : 'App User',
        r.identifier || '-', r.contact || '-', r.schoolName || '-', r.city || '-', r.state || '-',
        absoluteTime(r.lastLoginAt) ?? 'Never',
        u ? Math.round(u.activeSeconds / 60) : 0,
        u ? u.sessions : 0,
        u ? absoluteTime(u.lastSeen) ?? '-' : '-',
        new Date(r.createdAt).toLocaleDateString(),
      ];
    });
    const csv = [headers, ...csvRows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `user-activity-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const sel = "h-9 border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] w-full";
  const noUsage = !usageLoading && !usageError && (totals?.sessions ?? 0) === 0;

  return (
    <div className="space-y-2">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">User Activity &amp; App Usage</h1>
          <p className="text-xs text-gray-400 mt-0.5">How long people use the app, when, and from where — plus last-active time for every account</p>
        </div>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 bg-[#06013E] text-white px-4 py-2.5 text-sm font-semibold hover:bg-[#09025c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* ── App usage ── */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Activity size={14} className="text-gray-400" /> App usage
            {usageLoading && <Loader2 size={13} className="animate-spin text-gray-400" />}
          </div>
          <div className="flex border border-gray-200">
            {RANGES.map(([d, label]) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-semibold ${days === d ? 'bg-[#06013E] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {usageError ? (
          <p className="px-5 py-10 text-center text-sm text-red-500">Could not load app usage.</p>
        ) : noUsage ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">
            No app usage recorded for this period yet. Usage is sent by the app (new build) when it opens and when it goes to the background.
          </p>
        ) : (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Headline numbers */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
              <StatTile icon={<Users size={11} />} label="Active users" value={String(totals?.users ?? 0)}
                sub={`${totals?.accounts ?? 0} logged in · ${totals?.guests ?? 0} guest devices`} />
              <StatTile icon={<Activity size={11} />} label="Sessions" value={String(totals?.sessions ?? 0)} />
              <StatTile icon={<Timer size={11} />} label="Total time in app" value={fmtDuration(totals?.activeSeconds ?? 0)}
                sub={`+ ${fmtDuration(totals?.idleSeconds ?? 0)} idle`} />
              <StatTile icon={<Clock size={11} />} label="Avg per user" value={fmtDuration((totals?.activeSeconds ?? 0) / Math.max(totals?.users ?? 0, 1))}
                sub={days > 1 ? `over ${rangeLabel}` : 'today'} />
              <StatTile icon={<Clock size={11} />} label="Avg session" value={fmtDuration((totals?.activeSeconds ?? 0) / Math.max(totals?.sessions ?? 0, 1))} />
              <StatTile icon={<TrendingUp size={11} />} label="Peak hour" value={peak ? hourLabel(peak.hour) : '—'}
                sub={peak ? `${hourLabel(peak.hour)}–${hourLabel((peak.hour + 1) % 24)} · ${peak.users} users` : undefined} />
            </div>

            <div className={`grid grid-cols-1 ${days > 1 ? 'xl:grid-cols-2' : ''} gap-4`}>
              {/* Daily traffic */}
              {days > 1 && (
                <div className="border border-gray-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-bold text-gray-600">Daily traffic</p>
                    <div className="flex border border-gray-200">
                      {DAILY_METRICS.map(([k, label]) => (
                        <button key={k} onClick={() => setDailyMetric(k)}
                          className={`px-2 py-1 text-[11px] font-semibold ${dailyMetric === k ? 'bg-[#004f9f] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#EEF0F3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }}
                        interval={dailyData.length > 14 ? Math.ceil(dailyData.length / 10) - 1 : 0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,79,159,0.06)' }}
                        content={<ChartTooltip render={(p) => (
                          <>
                            <p className="font-semibold text-gray-800 mb-0.5">{String(p.label)}</p>
                            <p>{p.users} active users</p>
                            <p>{fmtDuration(Number(p.activeSeconds))} in app</p>
                            <p>{p.sessions} sessions</p>
                          </>
                        )} />} />
                      <Bar dataKey={dailyMetric} fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Peak hours */}
              <div className="border border-gray-100 p-3">
                <p className="text-xs font-bold text-gray-600 mb-2">
                  Peak hours <span className="font-normal text-gray-400">— active users by hour of day (IST){peak ? `, busiest ${hourLabel(peak.hour)}` : ''}</span>
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#EEF0F3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} interval={2} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,79,159,0.06)' }}
                      content={<ChartTooltip render={(p) => (
                        <>
                          <p className="font-semibold text-gray-800 mb-0.5">{hourLabel(Number(p.hour))}–{hourLabel((Number(p.hour) + 1) % 24)}</p>
                          <p>{p.users} active users</p>
                          <p>{p.sessions} sessions started</p>
                          <p>{fmtDuration(Number(p.activeSeconds))} in app</p>
                        </>
                      )} />} />
                    <Bar dataKey="users" radius={[4, 4, 0, 0]} maxBarSize={18}>
                      {hourlyData.map(h => (
                        <Cell key={h.hour} fill={peak && h.hour === peak.hour ? BRAND : BRAND_SOFT} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Location + platform */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {([['By state', locations.states], ['By city', locations.cities]] as const).map(([title, list]) => (
                <div key={title} className="border border-gray-100">
                  <p className="px-3 py-2 border-b border-gray-100 text-xs font-bold text-gray-600 flex items-center gap-1.5">
                    <MapPin size={12} className="text-gray-400" /> {title}
                    <span className="font-normal text-gray-400">(logged-in users, by their school)</span>
                  </p>
                  {list.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-gray-400">No logged-in usage yet.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-400 text-[10px] uppercase tracking-wider">
                        <th className="text-left px-3 py-1.5 font-bold">Place</th>
                        <th className="text-right px-3 py-1.5 font-bold">Users</th>
                        <th className="text-right px-3 py-1.5 font-bold">Time</th>
                      </tr></thead>
                      <tbody>
                        {list.map(l => (
                          <tr key={l.name} className="border-t border-gray-50">
                            <td className={`px-3 py-1.5 ${l.name === 'Unknown' ? 'text-gray-400 italic' : 'text-gray-700'}`}>{l.name}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{l.users}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-[#004f9f]">{fmtDuration(l.seconds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
              <div className="border border-gray-100">
                <p className="px-3 py-2 border-b border-gray-100 text-xs font-bold text-gray-600 flex items-center gap-1.5">
                  <Smartphone size={12} className="text-gray-400" /> Devices
                </p>
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-400 text-[10px] uppercase tracking-wider">
                    <th className="text-left px-3 py-1.5 font-bold">Platform</th>
                    <th className="text-right px-3 py-1.5 font-bold">Users</th>
                    <th className="text-right px-3 py-1.5 font-bold">Sessions</th>
                  </tr></thead>
                  <tbody>
                    {(usage?.platforms ?? []).map(p => (
                      <tr key={p.platform} className="border-t border-gray-50">
                        <td className="px-3 py-1.5 text-gray-700 capitalize">{p.platform === 'ios' ? 'iOS' : p.platform}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600">{p.users}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600">{p.sessions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Filter size={14} className="text-gray-400" />
            Filters
            {activeFilterCount > 0 && <span className="bg-[#06013E] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
              <X size={12} /> Clear all
            </button>
          )}
        </div>
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Account Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className={sel}>
              <option>All</option><option>Olympiad User</option><option>General User</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Activity</label>
            <select value={filterActivity} onChange={e => setFilterActivity(e.target.value)} className={sel}>
              <option>All</option><option>Active (24h)</option><option>Never logged in</option><option>Used app in range</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sort by</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={sel}>
              <option>Last active</option><option>Time in app</option><option>Last in app</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input type="text" placeholder="Name / ID / mobile / school..." value={search}
                onChange={e => setSearch(e.target.value)} autoComplete="off"
                className="h-9 w-full border border-gray-200 pl-8 pr-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-stretch border border-gray-200 bg-white divide-x divide-gray-200">
        <div className="flex items-center gap-3 px-6 py-3">
          <Users size={17} className="text-[#004f9f]" />
          <span className="text-2xl font-bold text-[#004f9f]">{filtered.length}</span>
          <span className="text-sm text-gray-400">Total</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <GraduationCap size={17} className="text-amber-600" />
          <span className="text-2xl font-bold text-amber-700">{olympiadCount}</span>
          <span className="text-sm text-gray-400">Olympiad Users</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Smartphone size={17} className="text-blue-600" />
          <span className="text-2xl font-bold text-blue-700">{generalCount}</span>
          <span className="text-sm text-gray-400">General Users</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Clock size={17} className="text-green-600" />
          <span className="text-2xl font-bold text-green-700">{activeNowCount}</span>
          <span className="text-sm text-gray-400">Active (24h)</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-600">
            <span className="text-[#004f9f]">{filtered.length}</span> accounts
            <span className="ml-2 text-xs font-normal text-gray-400">App usage columns cover: {rangeLabel}</span>
          </p>
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider w-10">S.No</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Type</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Identifier</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">School</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Contact</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Last Active</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider">Time in App</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider">Sessions</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Last in App</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-16 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#004f9f] mb-2" />
                  <p className="text-gray-400 text-sm">Loading...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="py-16 text-center text-gray-400 text-sm">
                  {rows.length === 0 ? 'No user activity yet.' : 'No records match your filters.'}
                </td></tr>
              ) : filtered.map((r, idx) => {
                const recent = isRecentlyActive(r.lastLoginAt);
                const u = usageOf(r);
                return (
                  <tr key={`${r.type}-${r.id}`} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      {r.accountKind === 'OLYMPIAD'
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5"><GraduationCap size={10} />Olympiad</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5"><Smartphone size={10} />General</span>
                      }
                      {/* An Olympiad account exists twice over: the school's
                          Student record and the student's own app login. The
                          sub-label keeps those distinguishable now that the
                          main badge shows Olympiad/General instead. */}
                      <span className="block mt-0.5 text-[10px] text-gray-400">
                        {r.type === 'STUDENT' ? 'Student' : 'App User'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800 text-sm">{r.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {r.identifier
                        ? <span className="font-semibold text-[#004f9f]">{r.identifier}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {r.schoolName
                        ? <span className="inline-flex items-center gap-1"><School size={11} className="text-gray-400" />{r.schoolName}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-500 text-xs">{r.contact || <span className="text-gray-300">-</span>}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${recent ? 'text-green-700' : r.lastLoginAt ? 'text-gray-500' : 'text-gray-300 italic'}`}>
                        {recent && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                        {relativeTime(r.lastLoginAt)}
                      </span>
                      {/* Exact timestamp under the relative one — "5d ago" is
                          good for scanning, useless for answering when. */}
                      {r.lastLoginAt && (
                        <span className="block mt-0.5 text-[10px] text-gray-400 font-normal">
                          {absoluteTime(r.lastLoginAt)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap">
                      {u ? (
                        <>
                          <span className="font-semibold text-[#004f9f]">{fmtDuration(u.activeSeconds)}</span>
                          <span className="block text-[10px] text-gray-400">avg {fmtDuration(u.activeSeconds / Math.max(u.sessions, 1))} / session</span>
                        </>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-gray-600">{u ? u.sessions : <span className="text-gray-300">-</span>}</td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      {u ? (
                        <>
                          <span className="font-semibold text-gray-600">{relativeTime(u.lastSeen)}</span>
                          <span className="block mt-0.5 text-[10px] text-gray-400">{absoluteTime(u.lastSeen)}</span>
                        </>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
            <span>Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of <span className="font-semibold text-gray-600">{rows.length}</span> accounts</span>
            <span className="italic">© mittmee</span>
          </div>
        )}
      </div>
    </div>
  );
}
