'use client';

import { useRef, useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';

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

export default function TermsAcceptanceModal({
  onAccept,
  onLogout,
}: {
  onAccept: () => Promise<void>;
  onLogout: () => void;
}) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolledToEnd(true);
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 bg-[#052E5C] text-white">
          <ShieldCheck size={22} className="text-[#4ADE80] flex-shrink-0" />
          <div>
            <h2 className="text-lg font-bold leading-tight">Terms and Conditions</h2>
            <p className="text-xs text-blue-100/70 mt-0.5">Please read and accept to continue</p>
          </div>
        </div>

        {/* Scrollable body */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm text-slate-700">
          <p className="text-slate-600">
            By accessing this portal, you confirm that you have read, understood, and agree to the following:
          </p>
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <p className="font-semibold text-slate-900">{s.title}</p>
              <p className="mt-0.5 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4 space-y-3 bg-slate-50">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {!scrolledToEnd && (
            <p className="text-xs text-slate-400">Scroll to the end to enable acceptance.</p>
          )}
          <label className={`flex items-start gap-2.5 select-none ${scrolledToEnd ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={!scrolledToEnd}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#009846] flex-shrink-0"
            />
            <span className="text-sm text-slate-700">I have read and agree to the above.</span>
          </label>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={onLogout}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Log out instead
            </button>
            <button
              type="button"
              disabled={!checked || submitting}
              onClick={handleAccept}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0e4f8a] to-[#16a34a] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#0e4f8a]/25 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
              Accept &amp; Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
