'use client';

/**
 * Shared chrome for the school panel — the single implementation of page
 * headers, metric tiles, badges, tables, modals and async states, so every page
 * speaks the same visual language.
 */

import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { CARD, NEUTRAL, STATUS, type StatusTone } from './ui';

/* ── Page header ─────────────────────────────────────────────────────────── */

/**
 * Page title block. The title is the page's identity — no decorative icon tile
 * beside it — and the subtitle is always visible because it explains what the
 * page is for. `icon` is accepted for API compatibility; the sidebar already
 * shows each page's icon next to its name.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-[18px] font-semibold leading-tight tracking-[-0.015em] text-[#0B1B33]">{title}</h1>
        {subtitle && <p className="mt-0.5 max-w-2xl text-[12.5px] leading-snug text-[#677285]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Stat tile ───────────────────────────────────────────────────────────── */

/**
 * A single metric. The number carries the emphasis (large, tabular); the card
 * stays neutral so a row of tiles reads as one group.
 *
 * Passing `onClick` turns the tile into a button — used where a tile stands for
 * a filter, so the count and the filter that produces it are the same control.
 * `active` then marks it with the brand accent.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  loading,
  active,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  loading?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      {active && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2.5px] rounded-t-lg bg-[#1559C7]" />}
      <div className="flex items-center justify-between gap-2">
        <p className={`truncate text-[11.5px] font-medium ${active ? 'text-[#1559C7]' : 'text-[#556072]'}`}>{label}</p>
        {Icon && (
          <Icon
            size={14}
            strokeWidth={1.75}
            className={`flex-shrink-0 ${active ? 'text-[#1559C7]' : 'text-[#98A1B2]'}`}
          />
        )}
      </div>
      {loading ? (
        <div className="mt-1.5 h-6 w-14 animate-pulse rounded-md bg-[#EEF0F3]" />
      ) : (
        <p className="mt-1 text-[21px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#0B1B33]">
          {value}
        </p>
      )}
      {hint && !loading && <p className="mt-1 truncate text-[11px] text-[#677285]">{hint}</p>}
    </>
  );

  const surface = `${CARD} relative overflow-hidden px-3 py-2.5 ${active ? '!border-[#1559C7]/60 bg-[#F7FAFF]' : ''}`;

  if (!onClick) return <div className={surface}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${surface} w-full cursor-pointer text-left transition-[border-color,box-shadow] ${
        active ? '' : 'hover:border-[#D2D7DF] hover:shadow-[0_2px_8px_rgba(15,27,45,0.06)]'
      } focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25`}
    >
      {body}
    </button>
  );
}

/* ── Status badge ────────────────────────────────────────────────────────── */

/**
 * Status pill: tinted fill, hairline ring, and an icon (or a dot) beside the
 * text — colour alone is never the only signal (WCAG 1.4.1).
 */
export function StatusBadge({
  tone,
  icon: Icon,
  children,
}: {
  tone: StatusTone;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  const c = STATUS[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[11.5px] font-semibold leading-none"
      style={{ color: c.fg, backgroundColor: c.bg, boxShadow: `inset 0 0 0 1px ${c.fg}26` }}
    >
      {Icon ? <Icon size={11} strokeWidth={2.5} /> : <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.fg }} />}
      {children}
    </span>
  );
}

/* ── Avatar ──────────────────────────────────────────────────────────────── */

export function Avatar({
  name,
  tint,
  size = 32,
}: {
  name: string;
  tint: string;
  size?: number;
}) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <span
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-inset ring-black/5 ${tint}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/* ── Async states ────────────────────────────────────────────────────────── */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={`${CARD} flex flex-col items-center gap-2 py-9`} role="status">
      <Loader2 className="h-5 w-5 animate-spin text-[#1559C7]" />
      <p className="text-[12.5px] text-[#677285]">{label}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-xl border border-[#F2D3D3] bg-[#FEF7F7] px-4 py-6 text-center text-[13px] font-medium text-[#B42323]"
      role="alert"
    >
      <AlertCircle size={16} className="flex-shrink-0" /> {message}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className={`${CARD} px-5 py-9 text-center`}>
      {Icon && (
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#E6E8EC] bg-[#F8F9FB]">
          <Icon size={18} strokeWidth={1.75} className="text-[#677285]" />
        </div>
      )}
      <p className="text-[14px] font-semibold text-[#0F1B2D]">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-[#677285]">{hint}</p>}
    </div>
  );
}

/* ── Table shell ─────────────────────────────────────────────────────────── */

/**
 * Wraps a table so it scrolls horizontally inside its own card instead of
 * pushing the page sideways on narrow screens.
 */
export function TableShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="overflow-x-auto">{children}</div>
      {footer && (
        <div className="flex items-center justify-between gap-3 border-t border-[#E6E8EC] bg-[#F8F9FB] px-4 py-2.5 text-[12px] text-[#677285]">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Row count summary for a table footer. */
export function RowCount({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  return (
    <span className="tabular-nums">
      Showing <span className="font-semibold text-[#2A3446]">{shown}</span> of{' '}
      <span className="font-semibold text-[#2A3446]">{total}</span> {noun}
    </span>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────────── */

export function ModalShell({
  eyebrow,
  title,
  onClose,
  children,
  maxWidth = 'max-w-md',
}: {
  eyebrow?: string;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1B33]/45 p-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidth} overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_-12px_rgba(11,27,51,0.35)] ring-1 ring-black/5`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
          <div className="min-w-0">
            {eyebrow && <p className="text-[12px] font-medium text-[#677285]">{eyebrow}</p>}
            <div className="mt-0.5 text-[16px] font-semibold tracking-[-0.01em] text-[#0B1B33]">{title}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1.5 -mt-1 cursor-pointer rounded-lg p-1.5 text-[#677285] transition-colors hover:bg-[#F4F5F7] hover:text-[#0F1B2D] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25"
          >
            <X size={16} />
          </button>
        </div>
        <div className="h-px bg-[#EEF0F3]" />
        {children}
      </div>
    </div>
  );
}

/* ── Misc ────────────────────────────────────────────────────────────────── */

/** Filter chip used in toolbars. The active chip is solid ink. */
export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25 ${
        active
          ? 'border-[#0B1B33] bg-[#0B1B33] text-white'
          : 'border-[#D9DDE4] bg-white text-[#475265] hover:border-[#C5CBD5] hover:text-[#0F1B2D]'
      }`}
    >
      {children}
    </button>
  );
}

/** Progress bar. Accent-filled; the percentage is always shown as text too. */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-[#EEF0F3]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[#1559C7] transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export const canvas = NEUTRAL.canvas;
