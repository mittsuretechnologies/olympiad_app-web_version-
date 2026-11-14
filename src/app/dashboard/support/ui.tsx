'use client';

// Building blocks shared by the Schools and App users tabs so both read as one
// inbox: toolbar, list/detail split pane, requester card, status pills and the
// reply composer.

import { type ReactNode, useEffect, useRef } from 'react';
import { mutate } from 'swr';
import { ArrowLeft, Inbox, Loader2, MessageSquareText, Search, Send } from 'lucide-react';

// ─── Tab badge counts ───────────────────────────────────────────────────────

// Counts-only requests: cheap, and the app-user one doesn't write a
// "user details viewed" audit entry the way loading the full list does.
export const COUNT_KEYS = {
  schools: '/api/dashboard/school-support?countsOnly=1',
  app: '/api/dashboard/support-tickets?countsOnly=1',
} as const;

/** Call after any change so the tab badges catch up straight away. */
export function refreshSupportCounts() {
  mutate(COUNT_KEYS.schools);
  mutate(COUNT_KEYS.app);
}

// ─── Dates ──────────────────────────────────────────────────────────────────

/** Compact time for list rows: "3:42 pm" today, "12 Nov" this year, else "12 Nov 2025". */
export function shortTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function fullTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ─── Pills ──────────────────────────────────────────────────────────────────

export type Tone = 'blue' | 'amber' | 'violet' | 'green' | 'red' | 'gray';

const TONE: Record<Tone, { pill: string; dot: string }> = {
  blue:   { pill: 'bg-blue-50 text-blue-700 ring-blue-600/15',       dot: 'bg-blue-500' },
  amber:  { pill: 'bg-amber-50 text-amber-800 ring-amber-600/20',    dot: 'bg-amber-500' },
  violet: { pill: 'bg-violet-50 text-violet-700 ring-violet-600/15', dot: 'bg-violet-500' },
  green:  { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15', dot: 'bg-emerald-500' },
  red:    { pill: 'bg-red-50 text-red-700 ring-red-600/15',          dot: 'bg-red-500' },
  gray:   { pill: 'bg-gray-100 text-gray-600 ring-gray-500/15',      dot: 'bg-gray-400' },
};

export function Pill({ tone, children, dot = false }: { tone: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE[tone].pill}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${TONE[tone].dot}`} />}
      {children}
    </span>
  );
}

// ─── Toolbar ────────────────────────────────────────────────────────────────

export function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-0.5">
      {options.map(o => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}>
            {o.label}
            {o.count !== undefined && (
              <span className={`tabular-nums ${active ? 'text-gray-500' : 'text-gray-400'}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-[13px] placeholder:text-gray-400 focus:border-[#004f9f] focus:outline-none focus:ring-2 focus:ring-[#004f9f]/10" />
    </div>
  );
}

export function Select({ value, onChange, children, className = '' }: {
  value: string; onChange: (v: string) => void; children: ReactNode; className?: string;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-[13px] text-gray-700 focus:border-[#004f9f] focus:outline-none focus:ring-2 focus:ring-[#004f9f]/10 ${className}`}>
      {children}
    </select>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">{children}</div>;
}

// ─── Split pane ─────────────────────────────────────────────────────────────

/**
 * Inbox layout: list on the left, the open item on the right. Below `lg` only
 * one side shows at a time, with a back button on the detail side.
 */
export function SplitPane({
  listHeader, list, detail, onBack, emptyDetail,
}: {
  listHeader: ReactNode;
  list: ReactNode;
  detail: ReactNode | null;
  onBack: () => void;
  emptyDetail: string;
}) {
  const open = detail !== null;
  return (
    <div className="grid h-[calc(100vh-17rem)] min-h-[540px] overflow-hidden rounded-xl border border-gray-200 bg-white lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
      <section className={`${open ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-gray-200 lg:border-r`}>
        <div className="flex h-10 shrink-0 items-center border-b border-gray-100 px-4 text-xs text-gray-500">{listHeader}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
      </section>
      <section className={`${open ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col`}>
        {open ? (
          <>
            <button type="button" onClick={onBack}
              className="flex h-10 shrink-0 items-center gap-1.5 border-b border-gray-100 px-4 text-xs font-medium text-gray-600 hover:text-gray-900 lg:hidden">
              <ArrowLeft size={14} /> Back to list
            </button>
            {detail}
          </>
        ) : (
          <EmptyState icon={<MessageSquareText size={20} />} title="Nothing selected" body={emptyDetail} />
        )}
      </section>
    </div>
  );
}

export function ListRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} aria-current={selected || undefined}
        className={`block w-full border-l-2 px-4 py-3 text-left transition-colors ${
          selected ? 'border-[#004f9f] bg-[#004f9f]/[0.05]' : 'border-transparent hover:bg-gray-50'
        }`}>
        {children}
      </button>
    </li>
  );
}

export function UnreadDot({ label }: { label: string }) {
  return <span className="h-2 w-2 shrink-0 rounded-full bg-[#004f9f]" aria-label={label} title={label} />;
}

export function LoadingState() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center gap-2 text-sm text-gray-400">
      <Loader2 size={16} className="animate-spin" /> Loading…
    </div>
  );
}

export function EmptyState({ icon = <Inbox size={20} />, title, body }: { icon?: ReactNode; title: string; body?: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">{icon}</div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {body && <p className="mt-1 max-w-xs text-xs text-gray-500">{body}</p>}
    </div>
  );
}

// ─── Detail ─────────────────────────────────────────────────────────────────

export function DetailHeader({ eyebrow, title, meta, actions }: {
  eyebrow: ReactNode; title: string; meta: ReactNode; actions: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">{eyebrow}</p>
        <h2 className="mt-1 text-base font-semibold leading-snug text-gray-900 break-words">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">{meta}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

/** Who raised the request, with one-click contact links. */
export function RequesterCard({ avatar, name, sub, contacts }: {
  avatar: ReactNode;
  name: ReactNode;
  sub: ReactNode;
  contacts: { icon: ReactNode; label: string; href: string }[];
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#004f9f]/10 text-sm font-semibold text-[#004f9f]">
          {avatar}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{name}</p>
          <p className="truncate text-xs text-gray-500">{sub}</p>
        </div>
      </div>
      {contacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {contacts.map(c => (
            <a key={c.href} href={c.href}
              className="inline-flex max-w-[240px] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:border-gray-300 hover:text-gray-900">
              <span className="shrink-0 text-gray-400">{c.icon}</span>
              <span className="truncate">{c.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Buttons ────────────────────────────────────────────────────────────────

export function Button({
  children, onClick, disabled, variant = 'secondary', type = 'button', title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger-soft';
  type?: 'button' | 'submit';
  title?: string;
}) {
  const styles = {
    primary: 'bg-[#004f9f] text-white hover:bg-[#003f80] shadow-sm',
    secondary: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
    'danger-soft': 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}>
      {children}
    </button>
  );
}

// ─── Composer ───────────────────────────────────────────────────────────────

export function Composer({
  value, onChange, onSend, busy, placeholder, maxLength, options, hint, error, sendLabel = 'Send reply',
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  placeholder: string;
  maxLength?: number;
  options?: ReactNode;
  hint?: ReactNode;
  error?: string;
  sendLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grow with the text up to ~8 lines, then scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white p-3 sm:p-4">
      <div className="rounded-lg border border-gray-200 focus-within:border-[#004f9f] focus-within:ring-2 focus-within:ring-[#004f9f]/10">
        <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} maxLength={maxLength} rows={3}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSend(); } }}
          className="block w-full resize-none rounded-t-lg border-0 bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none" />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">{options}</div>
          <Button variant="primary" onClick={onSend} disabled={busy || !value.trim()} title="Ctrl + Enter">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {sendLabel}
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {hint && <p className="mt-2 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}
