'use client';

/**
 * Shared chrome for the school panel.
 *
 * Every page previously rolled its own gradient banner and stat cards, which is
 * why the panel drifted into eight colour families. These components are the
 * single implementation of those patterns.
 */

import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { CARD, NEUTRAL, STATUS, type StatusTone } from './ui';

/* ── Page header ─────────────────────────────────────────────────────────── */

/**
 * Flat page header. Replaces the per-page coloured banner: the page is
 * identified by its title, not by its hue.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      {/* The subtitle is descriptive, not load-bearing, so it stays hidden and
          reveals inline on hover/focus — the header costs no vertical space at
          rest. No `title` attribute: the browser tooltip would duplicate the
          same text on hover. Focus keeps it reachable without a mouse. */}
      <div
        className="group flex min-w-0 items-center gap-2.5"
        tabIndex={subtitle ? 0 : undefined}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#1559C7]/[0.08]">
          <Icon size={16} className="text-[#1559C7]" strokeWidth={2} />
        </div>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          {/* Navy, not the accent blue: it ties the heading to the sidebar
              without borrowing the colour that marks something as clickable. */}
          <h1 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-[#0E2A5C]">
            {title}
          </h1>
          {subtitle && (
            <p className="max-w-0 truncate text-[12.5px] text-[#6B7280] opacity-0 transition-[max-width,opacity] duration-200 group-hover:max-w-md group-hover:opacity-100 group-focus:max-w-md group-focus:opacity-100 motion-reduce:transition-none">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Stat tile ───────────────────────────────────────────────────────────── */

/**
 * A single metric. The number carries the emphasis (600 weight, large); the
 * card itself stays neutral so a row of tiles reads as one group.
 *
 * Passing `onClick` turns the tile into a button — used where a tile stands for
 * a filter, so the count and the filter that produces it are the same control.
 * `active` then tints it to match the filter currently applied.
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
      <div className="flex items-center gap-1.5">
        {Icon && (
          <Icon
            size={13}
            strokeWidth={2}
            className={`flex-shrink-0 ${active ? 'text-[#1559C7]' : 'text-[#6B7280]'}`}
          />
        )}
        <p className={`truncate text-[11.5px] font-medium ${active ? 'text-[#1559C7]' : 'text-[#6B7280]'}`}>
          {label}
        </p>
      </div>
      {loading ? (
        <div className="mt-1.5 h-6 w-14 animate-pulse rounded bg-[#F1F3F6]" />
      ) : (
        <p className={`mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] ${
          active ? 'text-[#1559C7]' : 'text-[#111827]'
        }`}>
          {value}
        </p>
      )}
      {hint && !loading && <p className="mt-1 truncate text-[11.5px] text-[#6B7280]">{hint}</p>}
    </>
  );

  const surface = active
    ? 'bg-[#1559C7]/[0.05] rounded-lg border border-[#1559C7] shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
    : CARD;

  if (!onClick) {
    return <div className={`${surface} px-3.5 py-2.5`}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${surface} w-full cursor-pointer px-3.5 py-2.5 text-left transition-colors ${
        active ? '' : 'hover:border-[#C3CEDE] hover:bg-[#FAFBFC]'
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1559C7]/40`}
    >
      {body}
    </button>
  );
}

/* ── Status badge ────────────────────────────────────────────────────────── */

/**
 * Status pill. The icon is not optional by convention — colour alone must never
 * be the only signal (WCAG 1.4.1), and these badges are read at a glance.
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
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold"
      style={{ color: c.fg, backgroundColor: c.bg }}
    >
      {Icon && <Icon size={11} strokeWidth={2.5} />}
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
      className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold ${tint}`}
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
    <div className={`${CARD} flex flex-col items-center gap-2 py-12`} role="status">
      <Loader2 className="h-4 w-4 animate-spin text-[#1559C7]" />
      <p className="text-[12.5px] text-[#6B7280]">{label}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="rounded-lg border border-[#F1D4D4] bg-[#FDF6F6] py-10 text-center text-[13px] text-[#B91C1C]"
      role="alert"
    >
      {message}
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
    <div className={`${CARD} py-12 text-center`}>
      {Icon && (
        <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#F6F7F9]">
          <Icon size={18} className="text-[#9CA3AF]" />
        </div>
      )}
      <p className="text-[13px] font-medium text-[#374151]">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-[#6B7280]">{hint}</p>}
    </div>
  );
}

/* ── Table shell ─────────────────────────────────────────────────────────── */

/**
 * Wraps a gridlined table so it scrolls horizontally inside its own card
 * instead of pushing the page sideways on narrow screens.
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
        <div className="flex items-center justify-between gap-3 border-t border-[#E4E8EE] bg-[#FAFBFC] px-3 py-2 text-[11.5px] text-[#6B7280]">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Row count summary for a table footer. */
export function RowCount({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  return (
    <span>
      Showing <span className="font-semibold text-[#374151]">{shown}</span> of{' '}
      <span className="font-semibold text-[#374151]">{total}</span> {noun}
    </span>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────────── */

/**
 * Modal shell with a flat header. Every modal in the panel used the same navy
 * gradient bar; this replaces it with a plain bordered header.
 */
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E1726]/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidth} overflow-hidden rounded-xl bg-white shadow-[0_16px_48px_rgba(16,24,40,0.18)]`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E4E8EE] px-5 py-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">
                {eyebrow}
              </p>
            )}
            <div className="mt-0.5 text-[15px] font-semibold text-[#0E2A5C]">{title}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 -mt-1 cursor-pointer rounded-lg p-1.5 text-[#6B7280] transition-colors hover:bg-[#F6F7F9] hover:text-[#111827] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1559C7]/40"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Misc ────────────────────────────────────────────────────────────────── */

/** Filter/segment pill used in toolbars. */
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
      className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1559C7]/40 ${
        active
          ? 'bg-[#1559C7] text-white'
          : 'bg-[#F6F7F9] text-[#4B5563] hover:bg-[#EDF0F4]'
      }`}
    >
      {children}
    </button>
  );
}

/** Thin progress bar. Accent-filled; percentage is always shown as text too. */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-[#EDF0F4]"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[#1559C7] transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export const canvas = NEUTRAL.canvas;
