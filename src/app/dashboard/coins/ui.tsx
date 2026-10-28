'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { authFetch } from '@/lib/swr';

// Small shared pieces for the Coins & Rewards dashboard tabs.

export async function api<T = any>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await authFetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

export function useLoad<T = any>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    if (!url) return;
    setLoading(true);
    api<T>(url).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [url]);
  useEffect(reload, [reload]);
  return { data, error, loading, reload };
}

export function Loading() {
  return <div className="flex items-center gap-2 text-gray-500 py-10 justify-center"><Loader2 className="animate-spin" size={18} /> Loading…</div>;
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertCircle size={16} className="mt-0.5 shrink-0" />{message}</div>;
}

export function Card({ title, hint, children, right }: { title?: string; hint?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h3 className="font-bold text-gray-900">{title}</h3>}
            {hint && <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">{hint}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#004f9f]/30 focus:border-[#004f9f]';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

export function Num({ value, onChange, min = 0, max, step = 1 }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input type="number" className={input} value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
  );
}

export function Text({ value, onChange, placeholder, multiline }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return multiline
    ? <textarea className={input} rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    : <input className={input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select className={input} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-gray-800">
      <span className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-[#009846]' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Btn({ children, onClick, tone = 'primary', disabled, busy, small }: {
  children: ReactNode; onClick?: () => void; tone?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; busy?: boolean; small?: boolean;
}) {
  const tones = {
    primary: 'bg-[#004f9f] text-white hover:bg-[#003d7a]',
    ghost: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
    danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold disabled:opacity-50 transition-colors ${small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm'} ${tones[tone]}`}>
      {busy && <Loader2 size={14} className="animate-spin" />}{children}
    </button>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div className={`bg-white rounded-2xl shadow-xl w-full my-8 ${wide ? 'max-w-3xl' : 'max-w-xl'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Pill({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue' }) {
  const t = {
    gray: 'bg-gray-100 text-gray-600 border-gray-200', green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200', red: 'bg-red-50 text-red-600 border-red-200',
    blue: 'bg-blue-50 text-[#004f9f] border-blue-200',
  }[tone];
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${t}`}>{children}</span>;
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// <input type="datetime-local"> works in local time without a zone.
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

export function DateField({ value, onChange }: { value: string | null | undefined; onChange: (iso: string | null) => void }) {
  return <input type="datetime-local" className={input} value={toLocalInput(value)} onChange={(e) => onChange(fromLocalInput(e.target.value))} />;
}
