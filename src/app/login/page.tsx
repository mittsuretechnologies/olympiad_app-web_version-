'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Users,
  School,
  Trophy,
  Sparkles,
  TrendingUp,
  CalendarClock,
  Activity,
  ShieldCheck,
} from 'lucide-react';

const STATS = [
  { icon: Users, value: '50,000+', label: 'Students Empowered', tint: 'from-emerald-500/30 to-green-500/20', ring: 'ring-emerald-400/20', ic: 'text-emerald-300' },
  { icon: School, value: '1,200+', label: 'Schools Onboarded', tint: 'from-blue-500/30 to-indigo-500/20', ring: 'ring-blue-400/20', ic: 'text-blue-300' },
  { icon: Trophy, value: '25+', label: 'Olympiads Conducted', tint: 'from-amber-500/30 to-yellow-500/20', ring: 'ring-amber-400/20', ic: 'text-amber-300' },
];

const TOPPERS = [
  { rank: 1, name: 'Arjun Malhotra', subject: 'Mathematics Olympiad 2026', school: 'Delhi Public School', medal: 'from-amber-400 to-yellow-500', av: 'from-rose-400 to-pink-500' },
  { rank: 2, name: 'Myra Sharma', subject: 'Science Olympiad 2026', school: 'Ryan Int. School', medal: 'from-slate-300 to-slate-400', av: 'from-violet-400 to-indigo-500' },
  { rank: 3, name: 'Vihaan Kapoor', subject: 'English Olympiad 2026', school: "St. Xavier's School", medal: 'from-orange-400 to-amber-600', av: 'from-cyan-400 to-teal-500' },
];

const MINI = [
  { icon: Activity, value: '12,438', label: 'Active Today', ic: 'text-emerald-300' },
  { icon: CalendarClock, value: '3 Days', label: 'To Next Olympiad', ic: 'text-blue-300' },
  { icon: TrendingUp, value: '98.7%', label: 'Participation Growth', ic: 'text-rose-300' },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/* ---------- Typewriter headline ---------- */
// "Empowering Future " (white) then "Champions" (teal). The split index marks
// where the teal-colored part begins.
const TW_FULL = 'Empowering Future Champions';
const TW_TEAL_START = 'Empowering Future '.length; // chars before "Champions"

function Typewriter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Type letter by letter (slow).
    if (count < TW_FULL.length) {
      const t = setTimeout(() => setCount((c) => c + 1), 140);
      return () => clearTimeout(t);
    }
    // Fully typed: hold a moment, then reset to start (no reverse erase).
    const t = setTimeout(() => setCount(0), 2200);
    return () => clearTimeout(t);
  }, [count]);

  const done = count >= TW_FULL.length;
  const whitePart = TW_FULL.slice(0, Math.min(count, TW_TEAL_START));
  const tealPart = count > TW_TEAL_START ? TW_FULL.slice(TW_TEAL_START, count) : '';

  // Render "Empowering" and "Future" on separate lines once typed past them.
  const renderWhite = whitePart
    .replace('Empowering ', 'Empowering\n')
    .split('\n')
    .map((line, i, arr) => (
      <span key={i}>
        {line}
        {i < arr.length - 1 ? <br /> : null}
      </span>
    ));

  return (
    <>
      <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
        {renderWhite}
      </span>
      <span className="bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(45,212,191,0.4)]">
        {tealPart}
      </span>
      {/* Blinking cursor */}
      <span
        className={`ml-0.5 inline-block w-[3px] -translate-y-1 self-end bg-cyan-300 align-middle ${
          done ? 'animate-pulse' : ''
        }`}
        style={{ height: '0.9em' }}
      />
    </>
  );
}

/* ---------- Small floating glossy bubbles (only in the side gutters) ---------- */
// `left` values stay in the gutters outside the centered card (roughly <26% or >74%).
// Each gutter has 6 bubbles spread evenly top→bottom with staggered horizontal offsets.
// 7 per gutter, vertical steps of ~13% (5% → 95%) so the whole height is covered
// including the bottom. `left` values hug the OUTER edges, away from the card.
const BUBBLES = [
  // Left gutter — just to the right of the curve, in the visible light area
  { size: 16, top: '6%', left: '26%', from: '#bfdbfe', to: '#3b82f6', dur: 9, delay: 0 },
  { size: 12, top: '21%', left: '31%', from: '#a7f3d0', to: '#10b981', dur: 7, delay: 1.2 },
  { size: 22, top: '36%', left: '27%', from: '#ddd6fe', to: '#8b5cf6', dur: 11, delay: 0.5 },
  { size: 14, top: '51%', left: '32%', from: '#bae6fd', to: '#06b6d4', dur: 10, delay: 0.8 },
  { size: 18, top: '66%', left: '27%', from: '#fbcfe8', to: '#ec4899', dur: 9, delay: 0.3 },
  { size: 12, top: '81%', left: '31%', from: '#fde68a', to: '#f59e0b', dur: 8, delay: 2 },
  { size: 20, top: '95%', left: '26%', from: '#bfdbfe', to: '#2563eb', dur: 10.5, delay: 1.4 },
  // Right gutter
  { size: 14, top: '5%', left: '94%', from: '#bfdbfe', to: '#2563eb', dur: 12, delay: 1.6 },
  { size: 20, top: '20%', left: '86%', from: '#a7f3d0', to: '#14b8a6', dur: 7.5, delay: 1 },
  { size: 12, top: '35%', left: '96%', from: '#ddd6fe', to: '#7c3aed', dur: 10.5, delay: 2.4 },
  { size: 16, top: '50%', left: '87%', from: '#fde68a', to: '#f97316', dur: 8.5, delay: 0.6 },
  { size: 13, top: '65%', left: '95%', from: '#bae6fd', to: '#0ea5e9', dur: 9.5, delay: 1.8 },
  { size: 22, top: '80%', left: '88%', from: '#fbcfe8', to: '#db2777', dur: 11.5, delay: 0.2 },
  { size: 12, top: '94%', left: '96%', from: '#a7f3d0', to: '#10b981', dur: 9, delay: 1 },
];

function Bubbles() {
  // Plain CSS-animated spans — animation runs on the GPU compositor, not the
  // JS main thread, so it stays cheap even with many bubbles.
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="anim-bubble absolute rounded-full"
          style={
            {
              width: b.size,
              height: b.size,
              top: b.top,
              left: b.left,
              background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${b.from} 38%, ${b.to} 100%)`,
              boxShadow: `inset -2px -3px 5px rgba(0,0,0,0.15), 0 4px 12px -2px ${b.to}66`,
              opacity: 0.85,
              '--dur': `${b.dur}s`,
              '--delay': `${b.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      sessionStorage.removeItem('token');
      sessionStorage.removeItem('adminUser');
      sessionStorage.removeItem('schoolToken');
      sessionStorage.removeItem('schoolUser');
      sessionStorage.removeItem('reviewerToken');
      sessionStorage.removeItem('reviewerData');
      sessionStorage.removeItem('evaluatorToken');
      sessionStorage.removeItem('evaluatorData');

      if (data.role === 'SCHOOL') {
        sessionStorage.setItem('schoolToken', data.token);
        sessionStorage.setItem('schoolUser', JSON.stringify(data.user));
      } else if (data.role === 'REVIEWER') {
        sessionStorage.setItem('reviewerToken', data.token);
        sessionStorage.setItem('reviewerData', JSON.stringify(data.user));
      } else if (data.role === 'EVALUATOR') {
        sessionStorage.setItem('evaluatorToken', data.token);
        sessionStorage.setItem('evaluatorData', JSON.stringify(data.user));
      } else {
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('adminUser', JSON.stringify(data.user));
      }

      router.push(data.redirect || '/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#070d1f] text-white relative overflow-hidden">
      {/* Rich gradient base */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0a1834] via-[#0a1228] to-[#06110d]" />

      {/* Glowing orbs — GPU-composited CSS float (off main thread) */}
      <div
        className="anim-orb pointer-events-none absolute -top-32 left-[6%] w-[40rem] h-[40rem] rounded-full bg-blue-500/25 blur-[140px]"
        style={{ ['--dur' as string]: '14s' }}
      />
      <div
        className="anim-orb pointer-events-none absolute top-1/4 left-[26%] w-[34rem] h-[34rem] rounded-full bg-cyan-400/15 blur-[150px]"
        style={{ ['--dur' as string]: '18s', ['--delay' as string]: '2s' }}
      />
      <div
        className="anim-orb pointer-events-none absolute bottom-[-16rem] left-[2%] w-[34rem] h-[34rem] rounded-full bg-indigo-600/20 blur-[140px]"
        style={{ ['--dur' as string]: '16s', ['--delay' as string]: '1s' }}
      />
      {/* Softer teal glow behind the login card */}
      <div
        className="anim-orb pointer-events-none absolute top-1/3 right-[-8rem] w-[34rem] h-[34rem] rounded-full bg-emerald-500/15 blur-[150px]"
        style={{ ['--dur' as string]: '12s', ['--delay' as string]: '0.5s' }}
      />

      {/* ============ LEFT: SHOWCASE PANEL ============ */}
      <div className="hidden lg:flex lg:w-[58%] relative overflow-hidden bg-[#0a1430]">
        {/* Glowing world-map background image — full bleed */}
        <Image
          src="/login-bg.webp"
          alt=""
          fill
          priority
          sizes="58vw"
          className="object-cover object-center scale-105"
        />
        {/* Blend the image edges into the panel so it doesn't look like a pasted box */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1430] via-transparent to-[#0a1430] opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a1834]/45 via-[#0a1228]/25 to-[#06110d]/45" />

        {/* Curved 3D wave edge flowing toward the login card */}
        <svg
          className="absolute right-[-2px] top-0 z-20 h-full w-[190px]"
          viewBox="0 0 190 800"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            {/* Body gradient — light, gives the wave a rounded, lit surface */}
            <linearGradient id="waveBody" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#F2F7FE" />
              <stop offset="45%" stopColor="#EAF1FC" />
              <stop offset="100%" stopColor="#E2EDFB" />
            </linearGradient>
            {/* Bright edge highlight (light catching the crest) */}
            <linearGradient id="waveEdge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#68C8B6" stopOpacity="1" />
              <stop offset="50%" stopColor="#68C8B6" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#68C8B6" stopOpacity="1" />
            </linearGradient>
            {/* Soft drop shadow for depth — teal glow */}
            <filter id="waveShadow" x="-60%" y="-20%" width="220%" height="140%">
              <feDropShadow dx="-9" dy="0" stdDeviation="16" floodColor="#68C8B6" floodOpacity="0.45" />
            </filter>
            {/* Inner soft shading near the crest — gives the light surface depth */}
            <linearGradient id="waveSheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#68C8B6" stopOpacity="0.28" />
              <stop offset="18%" stopColor="#68C8B6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Shadow + solid body (raised surface) */}
          <path
            d="M190,0 L80,0 C150,200 30,360 100,520 C160,660 70,720 130,800 L190,800 Z"
            fill="url(#waveBody)"
            filter="url(#waveShadow)"
          />
          {/* Glossy sheen running just inside the crest */}
          <path
            d="M190,0 L80,0 C150,200 30,360 100,520 C160,660 70,720 130,800 L190,800 Z"
            fill="url(#waveSheen)"
          />
          {/* Bright lit crest line — the 3D highlight */}
          <path
            d="M80,0 C150,200 30,360 100,520 C160,660 70,720 130,800"
            fill="none"
            stroke="url(#waveEdge)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Soft glow under the crest line */}
          <path
            d="M80,0 C150,200 30,360 100,520 C160,660 70,720 130,800"
            fill="none"
            stroke="url(#waveEdge)"
            strokeWidth="9"
            strokeLinecap="round"
            opacity="0.25"
            style={{ filter: 'blur(5px)' }}
          />
        </svg>

        <div className="relative z-10 flex flex-col gap-6 px-5 pb-10 pt-4 xl:px-6 xl:pb-10 xl:pt-4 w-full">
          {/* Top row: logo (top-left) */}
          <div className="flex items-center gap-2.5">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl">
              <Image
                src="/mittmee-icon.jpeg"
                alt="mittmee"
                width={147}
                height={147}
                priority
                className="h-full w-full object-cover object-center drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
              />
            </div>
            <span className="text-xl font-bold tracking-tight"><span className="text-[#4FA8FF]">mitt</span><span className="text-[#7ED957]">mee</span></span>
          </div>

          <div className="flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/5 px-4 py-2 backdrop-blur-sm">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold tracking-wide text-blue-100">
              INDIA&apos;S MOST TRUSTED OLYMPIAD PLATFORM
            </span>
          </div>

          {/* Headline + stat cards (side by side like reference) */}
          <div className="flex items-start justify-between gap-8">
            <div className="max-w-xl">
              <h1 className="min-h-[2.4em] text-4xl xl:text-5xl font-extrabold leading-[1.08] tracking-tight">
                <Typewriter />
              </h1>
            </div>

            {/* Vertical stat cards */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="hidden xl:flex w-[230px] shrink-0 flex-col gap-3"
            >
              {STATS.map(({ icon: Icon, value, label, tint, ring, ic }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.12 }}
                  whileHover={{ y: -4, scale: 1.03 }}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-md shadow-lg shadow-black/20 transition-colors hover:border-cyan-400/30"
                >
                  <div className={`inline-flex rounded-xl bg-gradient-to-br ${tint} p-2.5 ring-1 ${ring}`}>
                    <Icon className={`w-5 h-5 ${ic}`} />
                  </div>
                  <div>
                    <div className="text-lg font-bold leading-tight text-white">{value}</div>
                    <div className="text-[11px] leading-tight text-slate-400">{label}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Celebrating Excellence — toppers */}
          <div className="mt-auto">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <span className="text-sm font-semibold text-slate-200">
                Celebrating Excellence
              </span>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.34 }}
              className="grid grid-cols-3 gap-3 max-w-3xl"
            >
              {TOPPERS.map((t, i) => (
                <motion.div
                  key={t.rank}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + i * 0.12 }}
                  whileHover={{ y: -4, scale: 1.03 }}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-3 backdrop-blur-md shadow-lg shadow-black/20 transition-colors hover:border-amber-300/30"
                >
                  {/* Avatar with medal badge */}
                  <div className="relative shrink-0">
                    <motion.div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${t.av} text-sm font-extrabold text-white shadow-md`}
                      whileHover={{ rotate: -6, scale: 1.08 }}
                    >
                      {initials(t.name)}
                    </motion.div>
                    <div
                      className={`absolute -bottom-1.5 -left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${t.medal} text-[10px] font-extrabold text-slate-900 ring-2 ring-[#0a1228]`}
                    >
                      {t.rank}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-amber-300">
                      AIR {t.rank}
                    </div>
                    <div className="truncate text-sm font-semibold text-white">
                      {t.name}
                    </div>
                    <div className="truncate text-[10px] text-slate-400">
                      {t.subject}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Mini stats row */}
            <div className="mt-4 grid grid-cols-3 gap-3 max-w-3xl">
              {MINI.map(({ icon: Icon, value, label, ic }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.85 + i * 0.1 }}
                  whileHover={{ y: -3 }}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-md transition-colors hover:border-white/20"
                >
                  <Icon className={`w-5 h-5 shrink-0 ${ic}`} />
                  <div>
                    <div className="text-sm font-bold leading-tight text-white">{value}</div>
                    <div className="text-[11px] leading-tight text-slate-400">{label}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ RIGHT: LOGIN CARD ============ */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden bg-[#E2EDFB] p-6 sm:p-10 lg:pr-16">
        <Bubbles />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-[420px] rounded-3xl border border-white/70 bg-white/60 p-1.5 shadow-[0_24px_70px_-18px_rgba(14,79,138,0.22)]"
        >
          <div className="rounded-[20px] bg-[#EEF4FC] p-7 sm:p-8 text-slate-900 shadow-sm">
            {/* Mobile logo */}
            <div className="lg:hidden mb-6 flex items-center justify-center gap-2">
              <Image
                src="/mittmee-icon.jpeg"
                alt="mittmee"
                width={73}
                height={73}
                priority
                className="h-11 w-11 rounded-xl object-cover"
              />
              <span className="text-lg font-bold tracking-tight"><span className="text-[#1559C7]">mitt</span><span className="text-[#3CB043]">mee</span></span>
            </div>

            {/* Header */}
            <div className="mb-7 text-center">
              <motion.div
                className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden shadow-lg shadow-[#0e4f8a]/30"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.2 }}
                whileHover={{ y: -3, rotate: 6 }}
              >
                <Image src="/mittmee-icon.jpeg" alt="mittmee" width={56} height={56} className="h-full w-full object-cover" />
              </motion.div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Welcome back!
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Sign in to continue to your account
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Identifier */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Email or School ID
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="text"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-[#0e4f8a] focus:outline-none focus:ring-4 focus:ring-[#0e4f8a]/10"
                    placeholder="admin@mittsure.com or MITT001"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-[#0e4f8a] focus:outline-none focus:ring-4 focus:ring-[#0e4f8a]/10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer select-none items-center gap-2">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-[#0e4f8a]"
                  />
                  <span className="text-sm text-slate-600">Remember me</span>
                </label>
                <a
                  href="/forgot-password"
                  className="text-sm font-semibold text-[#0e4f8a] transition-colors hover:text-[#16a34a]"
                >
                  Forgot password?
                </a>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#0e4f8a] to-[#16a34a] text-sm font-bold text-white shadow-lg shadow-[#0e4f8a]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#0e4f8a]/30 disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {/* Shine sweep on hover */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Sign in to your account
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>
            </form>

            <p className="mt-7 text-center text-xs text-slate-400">
              &copy; 2026 Mittsure Technologies. All rights reserved.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
