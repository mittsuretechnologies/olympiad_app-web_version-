'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Check, FileText, Loader2, Lock, LogOut } from 'lucide-react';
import {
  EVALUATOR_TERMS_DECLARATIONS,
  EVALUATOR_TERMS_INTRO,
  EVALUATOR_TERMS_PARTS,
  EVALUATOR_TERMS_VERSION,
  type TermsBlock,
} from '@/lib/evaluatorTerms';
import { BTN_PRIMARY, FOCUS } from '@/app/school/ui';

/**
 * First-login gate for Evaluators: a full page (same look as the School
 * Onboarding Agreement), not a popup. The Terms & Conditions and Privacy
 * Policy must be read to the end before the declarations appear; "I Accept"
 * stays disabled until every declaration is ticked. Cannot be dismissed —
 * the only ways out are accepting or logging out.
 */

const DECLARATIONS = EVALUATOR_TERMS_DECLARATIONS;

/** What the server records alongside the acceptance. */
export interface TermsAcceptancePayload {
  documentVersion: string;
  declarations: boolean[];
  readStartedAt: string;
  readCompletedAt: string | null;
}

const NUM_COL = 'grid grid-cols-[2.25rem_1fr] sm:grid-cols-[2.75rem_1fr] gap-x-1';

// **bold** -> <strong>
const inline = (text: string) =>
  text.split(/(\*\*.+?\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-[#0B1B36]">{part.slice(2, -2)}</strong>
      : part,
  );

// "1. Definitions" -> ["1", "Definitions"]
const splitTitle = (t: string) => {
  const m = t.match(/^(\d+)\.\s*(.*)$/);
  return m ? [m[1], m[2]] : ['', t];
};

function Blocks({ blocks, n }: { blocks: TermsBlock[]; n: string }) {
  return (
    <div className="mt-2.5 space-y-2.5">
      {blocks.map((b, bi) => {
        if (b.kind === 'p') return <div key={bi} className={NUM_COL}><span /><p>{inline(b.text)}</p></div>;
        if (b.kind === 'ol') {
          return b.items.map((t, i) => (
            <div key={`${bi}-${i}`} className={NUM_COL}>
              <span className="pt-[1px] text-[12.5px] tabular-nums text-[#677285]">{n}.{i + 1}.</span>
              <p>{inline(t)}</p>
            </div>
          ));
        }
        if (b.kind === 'ul') {
          return b.items.map((t, i) => (
            <div key={`${bi}-${i}`} className={NUM_COL}>
              <span className="pt-[1px] text-center text-[#677285]">•</span>
              <p>{inline(t)}</p>
            </div>
          ));
        }
        return (
          <div key={bi} className="overflow-x-auto rounded-lg border border-[#E6E8EC]">
            <table className="w-full border-collapse text-[12.5px] leading-[1.5]">
              <thead>
                <tr className="bg-[#F4F5F7]">
                  {b.head.map(h => (
                    <th key={h} scope="col" className="px-4 py-2.5 text-left text-[11.5px] font-semibold text-[#475265] border-b border-[#E6E8EC]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri} className="align-top border-b border-[#E6E8EC] last:border-0">
                    {r.map((c, ci) => (
                      <td key={ci} className={`px-4 py-3 ${ci === 0 ? 'font-semibold text-[#0B1B36]' : 'text-[#2A3446] border-l border-[#E6E8EC]'}`}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ['Read', 'Declarations', 'Accepted'];
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3 min-w-0" aria-current={current ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className={`h-px w-5 sm:w-8 ${n <= step ? 'bg-[#1559C7]' : 'bg-[#D2D7DF]'}`} />}
            <span className="flex items-center gap-2 min-w-0">
              <span className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10.5px] font-semibold ${
                done ? 'bg-[#1559C7] text-white' : current ? 'border-[1.5px] border-[#1559C7] text-[#1559C7]' : 'border border-[#D2D7DF] text-[#677285]'
              }`}>
                {done ? <Check size={11} strokeWidth={3} /> : n}
              </span>
              <span className={`text-[12.5px] whitespace-nowrap ${current ? 'font-medium text-[#0B1B36]' : done ? 'text-[#2A3446]' : 'text-[#677285]'} ${current ? '' : 'hidden sm:inline'}`}>{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function EvaluatorTermsGate({
  onAccept,
  onLogout,
}: {
  onAccept: (payload: TermsAcceptancePayload) => Promise<void>;
  onLogout: () => void;
}) {
  const readStartedAt = useRef(new Date().toISOString());
  const readCompletedAt = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [ticks, setTicks] = useState<boolean[]>(DECLARATIONS.map(() => false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The page behind stays put while the gate is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Reading progress, recomputed once per frame while this page scrolls.
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = docRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setProgress(Math.max(0, Math.min(1, (window.innerHeight - rect.top) / rect.height)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    sc.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      sc.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The declarations appear only once the end marker has been fully on screen.
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

  useEffect(() => {
    if (reachedEnd) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [reachedEnd]);

  const pct = Math.round(progress * 100);
  const remaining = ticks.filter(t => !t).length;
  const canAccept = reachedEnd && remaining === 0 && !busy;
  const step = reachedEnd ? 2 : 1;

  const accept = async () => {
    if (!canAccept) return;
    setBusy(true);
    setError('');
    try {
      await onAccept({
        documentVersion: EVALUATOR_TERMS_VERSION,
        declarations: ticks,
        readStartedAt: readStartedAt.current,
        readCompletedAt: readCompletedAt.current,
      });
    } catch {
      setError('Could not save your acceptance. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div
      ref={scrollRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#F6F6EE] font-sans"
    >
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#E6E8EC]">
        <div className="h-12 px-4 sm:px-6 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0">
              <Image src="/mittmee-icon.jpeg" alt="" width={24} height={24} className="object-cover w-full h-full" priority />
            </div>
            <span className="text-[15px] font-bold tracking-tight"><span className="text-[#1559C7]">mitt</span><span className="text-[#3CB043]">mee</span></span>
            <span className="hidden md:inline-flex items-center gap-1.5 h-7 ml-1 rounded-md border border-[#1559C7]/20 bg-[#1559C7]/[0.06] px-2.5 text-[12.5px] font-semibold text-[#0B1B33] min-w-0">
              <FileText size={13} className="flex-shrink-0 text-[#1559C7]" />
              <span className="truncate">Evaluator Terms &amp; Privacy Policy</span>
            </span>
          </div>
          <div className="hidden md:flex justify-center"><Stepper step={step} /></div>
          <div className="flex-1 flex items-center justify-end min-w-0">
            <button onClick={onLogout} className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-[#B42323] hover:bg-[#B42323]/[0.06] cursor-pointer ${FOCUS}`}>
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
        <div className="h-[3px] bg-[#E8E8DC]" role="progressbar" aria-label="Terms read" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#1559C7] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="px-4 sm:px-6 py-5 sm:py-8">
        <main className="min-w-0 max-w-[760px] w-full mx-auto">
          <div className="md:hidden mb-3 rounded-lg border border-[#E6E8EC] bg-white px-3 py-2.5"><Stepper step={step} /></div>

          <div ref={docRef} className="rounded-lg border border-[#E6E8EC] bg-white px-5 py-7 sm:px-10 sm:py-9 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_1px_2px_rgba(16,24,40,0.04)]">
            <article className="text-[14px] leading-[1.65] text-[#1F2937] [font-feature-settings:'cv11','ss01']">
              <header className="pb-4 border-b border-[#E6E8EC]">
                <h1 id="terms-title" className="text-[18px] sm:text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] text-[#0B1B36]">
                  Evaluator Terms &amp; Conditions and Privacy Policy
                </h1>
                <p className="mt-1 text-[12px] leading-snug text-[#677285]">Mittsure Technologies <span aria-hidden="true">·</span> Mittmee portal</p>
              </header>

              <div className="mt-5 rounded-md border border-[#E6E8EC] bg-[#F8F9FB] px-4 py-3">
                <p className="text-[12px] font-semibold text-[#2A3446]">IMPORTANT – PLEASE READ:</p>
                <p id="terms-intro" className="mt-1 text-[13px] leading-[1.6] text-[#475265]">{EVALUATOR_TERMS_INTRO}</p>
              </div>

              {EVALUATOR_TERMS_PARTS.map((part, idx) => (
                <div key={part.heading} className={idx === 0 ? 'mt-8' : 'mt-12 pt-8 border-t border-[#E6E8EC]'}>
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#0B1B36]">{part.heading}</h2>
                  <p className="mt-2 text-[#2A3446]">{part.intro}</p>
                  {part.sections.map(sec => {
                    const [n, title] = splitTitle(sec.title);
                    return (
                      <section key={sec.title} className="mt-7">
                        <h3 className={`${NUM_COL} items-baseline text-[15px] font-semibold tracking-[-0.01em] text-[#0B1B36]`}>
                          <span className="tabular-nums text-[#1559C7]">{n}.</span>
                          <span>{title}</span>
                        </h3>
                        <Blocks blocks={sec.blocks} n={n} />
                      </section>
                    );
                  })}
                </div>
              ))}

              <div className="mt-10 flex items-center gap-3 text-[11.5px] text-[#677285]">
                <span className="h-px flex-1 bg-[#E6E8EC]" />
                End of document
                <span className="h-px flex-1 bg-[#E6E8EC]" />
              </div>
            </article>
            <div ref={endRef} aria-hidden="true" className="h-1" />
          </div>

          {reachedEnd ? (
            <div ref={panelRef} className="mt-4 mb-10 scroll-mt-20 rounded-xl border border-[#E6E8EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="px-5 sm:px-8 py-6 space-y-6">
                <fieldset>
                  <legend className="text-[13px] font-semibold text-[#0B1B33]">Declarations <span className="font-normal text-[#677285]">— all are required</span></legend>
                  <div className="mt-3 space-y-2">
                    {DECLARATIONS.map((text, i) => (
                      <label
                        key={i}
                        className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 min-h-[44px] transition-colors ${
                          busy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-[#F8FAFC]'
                        } ${ticks[i] ? 'border-[#1559C7]/40 bg-[#1559C7]/[0.03]' : 'border-[#E6E8EC]'}`}
                      >
                        <input
                          type="checkbox"
                          checked={ticks[i]}
                          disabled={busy}
                          onChange={e => setTicks(t => t.map((v, j) => (j === i ? e.target.checked : v)))}
                          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-[#D2D7DF] accent-[#1559C7]"
                        />
                        <span className="text-[13px] leading-relaxed text-[#2A3446]">{text}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <p className="text-[12px] leading-relaxed text-[#677285] rounded-lg bg-[#F4F5F7] px-3.5 py-3">
                  We keep an electronic record of this acceptance: your name and Evaluator ID, the date and time, your IP address, the document version and the declarations you ticked.
                </p>

                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#B42323]/20 bg-[#B42323]/[0.06] px-3.5 py-2.5 text-[13px] text-[#B42323]">
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {error}
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                  <p className="text-[12px] text-[#677285]">
                    {remaining > 0 && (
                      <span className="text-[#B45309]">Tick {remaining === DECLARATIONS.length ? 'all the declarations' : `the remaining ${remaining} declaration${remaining > 1 ? 's' : ''}`} to enable I Accept.</span>
                    )}
                  </p>
                  <button onClick={accept} disabled={!canAccept} className={`${BTN_PRIMARY} h-11 px-6 text-[14px]`}>
                    {busy && <Loader2 size={16} className="animate-spin" />} I Accept
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 mb-20 flex items-center gap-2.5 rounded-lg border border-dashed border-[#D2D7DF] bg-white/60 px-4 py-3 text-[12.5px] text-[#677285]">
              <Lock size={14} className="flex-shrink-0" />
              Read the document to the end to continue to acceptance.
            </div>
          )}
        </main>
      </div>

      {/* Sticky reading reminder until the end is reached */}
      {!reachedEnd && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-[#E6E8EC] bg-white/95 backdrop-blur">
          <div className="max-w-[760px] mx-auto px-4 sm:px-0 h-12 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-[#0B1B33] truncate">Please read the complete document</p>
              <p className="text-[11px] text-[#677285] truncate">The accept option appears after the last section</p>
            </div>
            <span className="text-[12.5px] font-semibold tabular-nums text-[#1559C7]">{pct}% read</span>
          </div>
        </div>
      )}
    </div>
  );
}
