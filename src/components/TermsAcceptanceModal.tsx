'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle, ArrowDown, LogOut, Check } from 'lucide-react';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Confidentiality',
    body: 'All student submissions, personal details, scores, and evaluation data accessed through this portal are strictly confidential. You may not disclose them to any person outside the authorised evaluation process.',
  },
  {
    title: '2. Protection of minors',
    body: 'Submissions may contain videos and images of children. You may not download, screenshot, record, reproduce, store on personal devices, or share this content on social media or any external service under any circumstances.',
  },
  {
    title: '3. Impartial evaluation',
    body: "You agree to assess every submission solely on merit, against the prescribed criteria, without regard to the participant's identity, school, region, gender, religion, or any personal association.",
  },
  {
    title: '4. Conflict of interest',
    body: 'You must declare any relationship with a participant or institution whose work is assigned to you, and withdraw from evaluating that submission.',
  },
  {
    title: '5. Integrity of results',
    body: 'You may not alter, delete, or manipulate scores or records outside the official process, nor accept any inducement to influence an outcome.',
  },
  {
    title: '6. Account security',
    body: 'Your login ID and password are personal. Sharing credentials or allowing another person to review under your account is prohibited.',
  },
  {
    title: '7. Monitoring',
    body: 'All access and evaluation activity is logged and may be audited.',
  },
  {
    title: '8. Consequences',
    body: 'Any breach may result in immediate revocation of portal access, cancellation of assigned evaluations, and legal action where applicable.',
  },
  {
    title: '9. Responsibility and liability',
    body: 'You acknowledge that you are solely responsible for your actions, decisions, and conduct while accessing or using this portal. Any breach of this undertaking, misuse of portal access, unauthorised disclosure, or violation of applicable laws or these terms shall be your sole responsibility. Mittsure Technologies, its organisers, employees, or affiliates shall not be liable for any consequences arising from your actions or omissions.',
  },
];

// "1. Confidentiality" -> ["1", "Confidentiality"]: the number hangs in its own
// column; the wording itself is unchanged.
const splitTitle = (t: string) => {
  const m = t.match(/^(\d+)\.\s*(.*)$/);
  return m ? [m[1], m[2]] : ['', t];
};

/**
 * First-login Terms & Conditions gate for Moderator / Evaluator dashboard
 * access. It cannot be dismissed: the only ways out are accepting or logging
 * out. The checkbox unlocks once the end of the terms has been on screen.
 */
export default function TermsAcceptanceModal({
  onAccept,
  onLogout,
}: {
  onAccept: () => Promise<void>;
  onLogout: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    // Content that fits without scrolling counts as read to the end.
    const p = max <= 0 ? 1 : el.scrollTop / max;
    setProgress(Math.min(1, p));
    if (max <= 24 || el.scrollTop >= max - 24) setScrolledToEnd(true);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // The page behind stays put while the gate is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const scrollDown = () => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ top: el.clientHeight * 0.8, behavior: 'smooth' });
  };

  const handleAccept = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onAccept();
    } catch {
      setError('Could not save your acceptance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pct = Math.round(progress * 100);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#04172F]/70 backdrop-blur-[6px] p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        aria-describedby="terms-intro"
        className="w-full max-w-[640px] max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(4,23,47,0.45)] ring-1 ring-black/5 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 sm:px-7 pt-6 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#052E5C]/[0.06] ring-1 ring-[#052E5C]/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} className="text-[#052E5C]" />
            </div>
            <div className="min-w-0">
              <h2 id="terms-title" className="text-[17px] font-semibold tracking-[-0.01em] text-[#0B1B36] leading-tight">
                Terms and Conditions
              </h2>
              <p className="mt-1 text-[12.5px] text-[#6B7280]">Please read and accept to continue</p>
            </div>
          </div>
        </div>

        {/* Reading progress */}
        <div className="h-[3px] bg-[#EEF1F5]" role="progressbar" aria-label="Terms read" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#009846] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        </div>

        {/* Terms */}
        <div className="relative flex-1 min-h-0">
          <div
            ref={scrollRef}
            onScroll={measure}
            tabIndex={0}
            className="h-full max-h-[52vh] overflow-y-auto px-6 sm:px-7 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#052E5C]/30"
          >
            <p id="terms-intro" className="rounded-lg bg-[#F6F7F9] px-4 py-3 text-[13px] leading-relaxed text-[#374151]">
              By accessing this portal, you confirm that you have read, understood, and agree to the following:
            </p>
            <ol className="mt-4 divide-y divide-[#EEF1F5]">
              {SECTIONS.map(sec => {
                const [n, title] = splitTitle(sec.title);
                return (
                  <li key={sec.title} className="grid grid-cols-[2rem_1fr] gap-x-1 py-3.5 first:pt-1 last:pb-1">
                    <span className="pt-[1px] text-[13px] font-semibold tabular-nums text-[#009846]">{n}.</span>
                    <div>
                      <p className="text-[14px] font-semibold text-[#0B1B36]">{title}</p>
                      <p className="mt-1 text-[13.5px] leading-[1.65] text-[#4B5563]">{sec.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Fade + nudge until the end has been reached */}
          {!scrolledToEnd && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/85 to-transparent flex items-end justify-center pb-3">
              <button
                type="button"
                onClick={scrollDown}
                className="pointer-events-auto inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-[#052E5C] text-white text-[12px] font-medium shadow-md hover:bg-[#0A3B73] transition-colors cursor-pointer"
              >
                <ArrowDown size={13} className="motion-safe:animate-bounce" /> Scroll to read all terms
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#EEF1F5] bg-[#FAFBFC] px-6 sm:px-7 py-4 space-y-3.5">
          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
              <AlertCircle size={14} className="flex-shrink-0" /> {error}
            </div>
          )}

          <label
            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 select-none transition-colors ${
              !scrolledToEnd
                ? 'border-[#E4E8EE] bg-white/60 cursor-not-allowed'
                : checked
                  ? 'border-[#009846]/40 bg-[#009846]/[0.05] cursor-pointer'
                  : 'border-[#D3DAE4] bg-white cursor-pointer hover:border-[#009846]/40'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={!scrolledToEnd}
              onChange={e => setChecked(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#009846]/40 ${
                checked ? 'bg-[#009846] border-[#009846]' : 'bg-white border-[#C5CDD8]'
              }`}
            >
              {checked && <Check size={12} strokeWidth={3} className="text-white" />}
            </span>
            <span className={`text-[13.5px] ${scrolledToEnd ? 'text-[#111827]' : 'text-[#9CA3AF]'}`}>
              I have read and agree to the above.
            </span>
            {!scrolledToEnd && <span className="ml-auto text-[11.5px] text-[#9CA3AF] whitespace-nowrap">{pct}% read</span>}
          </label>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg text-[13px] font-medium text-[#6B7280] hover:text-[#B91C1C] hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut size={14} /> Log out instead
            </button>
            <button
              type="button"
              disabled={!checked || submitting}
              onClick={handleAccept}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg bg-[#052E5C] text-[13.5px] font-semibold text-white shadow-sm hover:bg-[#0A3B73] transition-colors disabled:bg-[#C5CDD8] disabled:text-white disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting && <Loader2 className="animate-spin" size={15} />}
              Accept &amp; Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
