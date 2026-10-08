'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, CheckCircle2, Loader2, Lock, LogOut, AlertCircle, RotateCw, School, FileText } from 'lucide-react';
import AgreementDocument from '@/components/agreements/AgreementDocument';
import {
  SCHOOL_AGREEMENT,
  SCHOOL_AGREEMENT_VERSION,
  schoolAgreementDeclarations,
} from '@/lib/agreements/school-onboarding';
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS } from './ui';

/**
 * First-login gate for the School Panel: the Authorised Representative must
 * read the School Onboarding Agreement to the end, tick the declarations and
 * click "I Accept" (Section 18.2). There is no details form and no OTP step:
 * the School Details on record are snapshotted server-side, and the school's
 * own logged-in admin account is recorded as the verification.
 * The acceptance form is not rendered at all until the end of the document
 * has been scrolled into view.
 */

interface StatusResponse {
  accepted: boolean;
  currentVersion: string;
  school: {
    name: string; schoolId: string; address: string | null; city: string | null; district: string | null;
    state: string | null; pincode: string | null; email: string | null; phone: string | null; contactPerson: string | null;
  };
}

interface Receipt {
  id: string; acceptedAt: string; signatoryName: string; signatoryDesignation: string;
  documentVersion: string; ipAddress: string | null;
}


const formatIst = (iso: string) =>
  `${new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  })} IST`;

export default function AgreementGate({
  token, onAccepted, onLogout,
}: { token: string; onAccepted: () => void; onLogout: () => void }) {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [data, setData] = useState<StatusResponse | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/school/me/agreement', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return onLogout();
      if (!res.ok) throw new Error();
      const json: StatusResponse = await res.json();
      if (json.accepted) return onAccepted();
      setData(json);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [token, onAccepted, onLogout]);

  useEffect(() => { load(); }, [load]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F6EE]">
        <Loader2 className="animate-spin text-[#1559C7]" size={28} aria-label="Loading" />
      </div>
    );
  }
  if (status === 'error' || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F6EE] p-4">
        <div className="max-w-sm w-full rounded-xl border border-[#E4E8EE] bg-white p-6 text-center">
          <AlertCircle className="mx-auto text-[#B91C1C]" size={28} />
          <p className="mt-3 text-[15px] font-semibold text-[#0E2A5C]">Couldn&apos;t load the agreement</p>
          <p className="mt-1 text-[13px] text-[#6B7280]">Check your connection and try again.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={onLogout} className={BTN_SECONDARY}>Log out</button>
            <button onClick={load} className={BTN_PRIMARY}><RotateCw size={14} /> Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return <GateScreen token={token} data={data} onAccepted={onAccepted} onLogout={onLogout} />;
}

/* ── Reading + acceptance screen ─────────────────────────────────────────── */

function GateScreen({
  token, data, onAccepted, onLogout,
}: { token: string; data: StatusResponse; onAccepted: () => void; onLogout: () => void }) {
  const docRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [emailedTo, setEmailedTo] = useState<string[]>([]);
  const readStartedAt = useRef(new Date().toISOString());
  const readCompletedAt = useRef<string | null>(null);

  // Reading progress, recomputed once per frame on scroll.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = docRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const read = (window.innerHeight - rect.top) / rect.height;
      setProgress(Math.max(0, Math.min(1, read)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The acceptance form unlocks only once the end marker has been on screen.
  useEffect(() => {
    const el = endRef.current;
    if (!el || reachedEnd) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        readCompletedAt.current = new Date().toISOString();
        setReachedEnd(true);
      }
    }, { threshold: 1 });
    io.observe(el);
    return () => io.disconnect();
  }, [reachedEnd]);

  // Mascots hop once when the end of the agreement is reached.
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    if (!reachedEnd) return;
    setCheer(true);
    const t = setTimeout(() => setCheer(false), 1400);
    return () => clearTimeout(t);
  }, [reachedEnd]);

  // After acceptance, move on automatically.
  useEffect(() => {
    if (!receipt) return;
    const t = setTimeout(onAccepted, 6000);
    return () => clearTimeout(t);
  }, [receipt, onAccepted]);

  const pct = Math.round(progress * 100);
  const step = receipt ? 3 : reachedEnd ? 2 : 1;

  return (
    <div className="min-h-screen bg-[#F6F6EE] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E4E8EE]">
        {/* Full width: brand pinned left, log out pinned right; the equal flex-1
            sides keep the stepper centred on the page. */}
        <div className="h-12 px-4 sm:px-6 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0">
              <Image src="/mittmee-icon.jpeg" alt="" width={24} height={24} className="object-cover w-full h-full" priority />
            </div>
            <span className="text-[15px] font-bold tracking-tight"><span className="text-[#1559C7]">mitt</span><span className="text-[#3CB043]">mee</span></span>
            <span className="hidden md:inline-flex items-center gap-1.5 h-7 ml-1 rounded-md border border-[#1559C7]/20 bg-[#1559C7]/[0.06] px-2.5 text-[12.5px] font-semibold text-[#0E2A5C] min-w-0">
              <FileText size={13} className="flex-shrink-0 text-[#1559C7]" />
              <span className="truncate">Onboarding Agreement</span>
            </span>
          </div>
          <div className="hidden md:flex justify-center">
            <Stepper step={step} />
          </div>
          <div className="flex-1 flex items-center justify-end gap-3 min-w-0">
            <span
              className="hidden lg:inline-flex items-center gap-1.5 h-7 max-w-[260px] rounded-md border border-[#E4E8EE] bg-[#F6F7F9] px-2.5 text-[12.5px] font-medium text-[#111827]"
              title={data.school.name}
            >
              <School size={13} className="flex-shrink-0 text-[#1559C7]" />
              <span className="truncate">{data.school.name}</span>
            </span>
            <button onClick={onLogout} className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-[#B91C1C] hover:bg-[#B91C1C]/[0.06] cursor-pointer ${FOCUS}`}>
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
        {/* Reading progress */}
        <div className="h-[3px] bg-[#E8E8DC]" role="progressbar" aria-label="Agreement read" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#1559C7] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${receipt ? 100 : pct}%` }} />
        </div>
      </header>

      {receipt ? (
        <SuccessCard receipt={receipt} emailedTo={emailedTo} onContinue={onAccepted} />
      ) : (
        <div className="px-4 sm:px-6 py-5 sm:py-8">
          <main className="min-w-0 max-w-[760px] w-full mx-auto">
            <div className="md:hidden mb-3 rounded-lg border border-[#E4E8EE] bg-white px-3 py-2.5"><Stepper step={step} /></div>

            <div ref={docRef} className="rounded-lg border border-[#E4E8EE] bg-white px-5 py-7 sm:px-10 sm:py-9 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)]">
              <AgreementDocument doc={SCHOOL_AGREEMENT} preparedFor={data.school.name} />
              <div ref={endRef} aria-hidden="true" className="h-1" />
            </div>

            {reachedEnd ? (
              <AcceptancePanel
                token={token}
                readStartedAt={readStartedAt.current}
                readCompletedAt={readCompletedAt.current}
                onLogout={onLogout}
                onDone={(r, emails) => { setEmailedTo(emails); setReceipt(r); window.scrollTo({ top: 0 }); }}
              />
            ) : (
              <div className="mt-3 mb-20 flex items-center gap-2.5 rounded-lg border border-dashed border-[#D3DAE4] bg-white/60 px-4 py-3 text-[12.5px] text-[#6B7280]">
                <Lock size={14} className="flex-shrink-0" />
                Read the agreement to the end to continue to acceptance.
              </div>
            )}
          </main>
        </div>
      )}

      {/* Mascots in the empty side gutters, wide screens only. */}
      {!receipt && (
        <div aria-hidden="true" className="hidden xl:block pointer-events-none select-none">
          <Mascot src="/mascots/binki.webp" side="left" delay={0} cheer={cheer} />
          <Mascot src="/mascots/binku.webp" side="right" delay={0.6} cheer={cheer} />
        </div>
      )}

      {/* Sticky reading reminder until the end is reached */}
      {!reachedEnd && !receipt && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-[#E4E8EE] bg-white/95 backdrop-blur">
          <div className="max-w-[760px] mx-auto px-4 sm:px-0 h-12 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-[#0E2A5C] truncate">Please read the complete agreement</p>
              <p className="text-[11px] text-[#6B7280] truncate">The accept option appears after the last section</p>
            </div>
            <span className="text-[12.5px] font-semibold tabular-nums text-[#1559C7]">{pct}% read</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Mascot ──────────────────────────────────────────────────────────────── */

/**
 * Binku / Binki standing in a side gutter. They idle with a slow float and
 * sway (offset per side so they never move in lockstep) and hop once when
 * `cheer` flips on. The art has a white background, so multiply blends it into
 * the page colour. Reduced-motion users get a static image.
 */
function Mascot({ src, side, delay, cheer }: { src: string; side: 'left' | 'right'; delay: number; cheer: boolean }) {
  const reduce = useReducedMotion();
  const tilt = side === 'left' ? -1 : 1;
  const animate = reduce
    ? { opacity: 1 }
    : cheer
      ? {
          opacity: 1,
          y: [0, -42, 0, -16, 0],
          rotate: [0, 8 * tilt, -4 * tilt, 0],
          transition: { duration: 1.2, ease: 'easeOut' as const },
        }
      : {
          opacity: 1,
          y: [0, -10, 0],
          rotate: [-1.5 * tilt, 1.5 * tilt, -1.5 * tilt],
          transition: {
            opacity: { duration: 0.6, delay },
            y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const, delay },
            rotate: { duration: 4.4, repeat: Infinity, ease: 'easeInOut' as const, delay },
          },
        };
  return (
    <motion.img
      src={src}
      alt=""
      initial={{ opacity: 0 }}
      animate={animate}
      className={`fixed bottom-16 z-10 h-[250px] 2xl:h-[300px] w-auto mix-blend-multiply ${side === 'left' ? '-translate-x-1/2' : 'translate-x-1/2'}`}
      style={{ [side]: 'calc((100vw - 760px) / 4)', transformOrigin: 'bottom center' }}
    />
  );
}

/* ── Stepper ─────────────────────────────────────────────────────────────── */

function Stepper({ step }: { step: number }) {
  const steps = ['Read', 'Declarations', 'Accepted'];
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step || step === 3;
        const current = n === step && step !== 3;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3 min-w-0" aria-current={current ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className={`h-px w-5 sm:w-8 ${n <= step ? 'bg-[#1559C7]' : 'bg-[#D3DAE4]'}`} />}
            <span className="flex items-center gap-2 min-w-0">
              <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10.5px] font-semibold ${
                done ? 'bg-[#1559C7] text-white' : current ? 'border-[1.5px] border-[#1559C7] text-[#1559C7]' : 'border border-[#D3DAE4] text-[#6B7280]'
              }`}>
                {done ? <Check size={11} strokeWidth={3} /> : n}
              </span>
              <span className={`text-[12.5px] whitespace-nowrap ${current ? 'font-medium text-[#0B1B36]' : done ? 'text-[#374151]' : 'text-[#6B7280]'} ${current ? '' : 'hidden sm:inline'}`}>{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Acceptance form ─────────────────────────────────────────────────────── */

function AcceptancePanel({
  token, readStartedAt, readCompletedAt, onDone, onLogout,
}: {
  token: string;
  readStartedAt: string;
  readCompletedAt: string | null;
  onDone: (r: Receipt, emailedTo: string[]) => void;
  onLogout: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const declarations = schoolAgreementDeclarations();
  const [ticks, setTicks] = useState<boolean[]>(declarations.map(() => false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, []);

  const remaining = ticks.filter(t => !t).length;
  const canAccept = remaining === 0 && !busy;

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.status === 401) { onLogout(); throw new Error('Session expired'); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'Something went wrong. Please try again.');
    return json;
  };

  const accept = async () => {
    setBusy(true); setError('');
    try {
      const json = await post('/api/school/me/agreement', {
        declarations: ticks,
        documentVersion: SCHOOL_AGREEMENT_VERSION, readStartedAt, readCompletedAt,
      });
      onDone(json.acceptance, json.emailedTo || []);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  const locked = busy;
  return (
    <div ref={panelRef} className="mt-4 mb-10 scroll-mt-20 rounded-xl border border-[#E4E8EE] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="px-5 sm:px-8 py-6 space-y-7">
        {/* Declarations */}
        <fieldset>
          <legend className="text-[13px] font-semibold text-[#0E2A5C]">Declarations <span className="font-normal text-[#6B7280]">— all are required</span></legend>
          <div className="mt-3 space-y-2">
            {declarations.map((text, i) => (
              <label
                key={i}
                className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 min-h-[44px] transition-colors ${
                  locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-[#F8FAFC]'
                } ${ticks[i] ? 'border-[#1559C7]/40 bg-[#1559C7]/[0.03]' : 'border-[#E4E8EE]'}`}
              >
                <input
                  type="checkbox"
                  checked={ticks[i]}
                  disabled={locked}
                  onChange={e => setTicks(t => t.map((v, j) => (j === i ? e.target.checked : v)))}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-[#D3DAE4] accent-[#1559C7]"
                />
                <span className="text-[13px] leading-relaxed text-[#374151]">{text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Record notice */}
        <p className="text-[12px] leading-relaxed text-[#6B7280] rounded-lg bg-[#F6F7F9] px-3.5 py-3">
          We keep an electronic record of this acceptance: the School Details on record, the date and time, your IP address,
          the verification and the agreement version.
        </p>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#B91C1C]/20 bg-[#B91C1C]/[0.06] px-3.5 py-2.5 text-[13px] text-[#B91C1C]">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <p className="text-[12px] text-[#6B7280]">
            {remaining > 0 && (
              <span className="text-[#B45309]">Tick {remaining === declarations.length ? 'all the declarations' : `the remaining ${remaining} declaration${remaining > 1 ? 's' : ''}`} to enable I Accept.</span>
            )}
          </p>
          <button onClick={accept} disabled={!canAccept} className={`${BTN_PRIMARY} h-11 px-6 text-[14px]`}>
            {busy && <Loader2 size={16} className="animate-spin" />} I Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Success ─────────────────────────────────────────────────────────────── */

function SuccessCard({ receipt, emailedTo, onContinue }: { receipt: Receipt; emailedTo: string[]; onContinue: () => void }) {
  const rows: [string, string][] = [
    ['Reference ID', receipt.id],
    ['Date & time', formatIst(receipt.acceptedAt)],
    ['Agreement version', receipt.documentVersion],
    ['IP address', receipt.ipAddress || 'Not available'],
  ];
  return (
    <div className="max-w-[560px] mx-auto px-4 py-12">
      <div className="rounded-xl border border-[#E4E8EE] bg-white p-6 sm:p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <CheckCircle2 size={44} className="mx-auto text-[#047857]" />
        <h1 className="mt-3 text-[19px] font-semibold text-[#0E2A5C]">Agreement accepted</h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">
          Thank you. Your school&apos;s acceptance has been recorded{emailedTo.length ? ` and a copy emailed to ${emailedTo.join(', ')}` : ''}.
        </p>
        <dl className="mt-6 text-left rounded-lg border border-[#E4E8EE] divide-y divide-[#E4E8EE]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_1fr] gap-3 px-4 py-2.5 text-[13px]">
              <dt className="text-[#6B7280]">{k}</dt>
              <dd className="text-[#111827] font-medium break-all">{v}</dd>
            </div>
          ))}
        </dl>
        <button onClick={onContinue} className={`${BTN_PRIMARY} mt-6 h-11 px-6 text-[14px]`}>Continue to dashboard</button>
        <p className="mt-2 text-[11.5px] text-[#9CA3AF]">Continuing automatically…</p>
      </div>
    </div>
  );
}
