'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Bell, Loader2, Send, X, Search, CheckCircle2, Megaphone, Trash2, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { fetcher, authFetch } from '@/lib/swr';
import { NOTIFICATION_LIMITS, PANEL_LINKS } from '@/lib/schoolNotificationConfig';

// Dashboard → School Notifications: a message to the notification bell in
// schools' web School Panel. Passport releases and new Olympiad IDs notify the
// school on their own. (App Notifications reaches app users, and Olympiad
// schools too; this page reaches schools only.)

type Mode = 'ALL' | 'STATE' | 'SCHOOLS';
interface PickedSchool { schoolId: string; name: string; city: string | null; state: string | null }
interface Picker { total: number; states: { state: string; count: number }[]; schools: PickedSchool[] }
interface HistoryEntry { title: string; message: string; link: string | null; sentAt: string; recipients: number; read: number }

const fmt = (n: number) => n.toLocaleString('en-IN');
const linkLabel = (v: string | null) => PANEL_LINKS.find(l => l.value === v)?.label ?? v ?? '';

export default function SchoolNotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [mode, setMode] = useState<Mode>('ALL');
  const [states, setStates] = useState<string[]>([]);
  const [schools, setSchools] = useState<PickedSchool[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sending, setSending] = useState(false);
  const [recalling, setRecalling] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: picker, error: pickerError } = useSWR<Picker>(
    `/api/dashboard/school-notifications/schools?q=${encodeURIComponent(mode === 'SCHOOLS' ? debounced : '')}`, fetcher, { keepPreviousData: true },
  );
  const { data: hist, error: histError, mutate: refreshHistory } = useSWR<{ history: HistoryEntry[] }>('/api/dashboard/school-notifications', fetcher);

  const toggleState = (s: string) => setStates(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
  const addSchool = (s: PickedSchool) => {
    setSchools(prev => (prev.some(p => p.schoolId === s.schoolId) ? prev : [...prev, s]));
    setSearch('');
  };

  // How many schools the current target reaches (before sending).
  const reach = mode === 'ALL'
    ? picker?.total ?? null
    : mode === 'STATE'
      ? (picker?.states ?? []).filter(s => states.includes(s.state)).reduce((n, s) => n + s.count, 0)
      : schools.length;

  const targetReady = mode === 'ALL' || (mode === 'STATE' && states.length > 0) || (mode === 'SCHOOLS' && schools.length > 0);
  const canSend = !!title.trim() && !!message.trim() && targetReady && !sending;
  const targetLabel = mode === 'ALL'
    ? 'ALL active schools'
    : mode === 'STATE'
      ? `schools in ${states.join(', ')}`
      : `${schools.length} selected school${schools.length === 1 ? '' : 's'}`;

  const send = async () => {
    if (!canSend) return;
    const count = reach != null ? ` (${fmt(reach)} school${reach === 1 ? '' : 's'})` : '';
    if (!window.confirm(`Send "${title.trim()}" to ${targetLabel}${count}?\n\nIt will appear in their School Panel notification bell right away.`)) return;
    setSending(true);
    setResult(null);
    try {
      const res = await authFetch('/api/dashboard/school-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, message, link: link || undefined,
          target: mode === 'ALL' ? { mode } : mode === 'STATE' ? { mode, states } : { mode, schoolIds: schools.map(s => s.schoolId) },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || 'Could not send the notification');
      setResult({ ok: true, text: `Sent to ${fmt(j.sent)} school${j.sent === 1 ? '' : 's'}.` });
      setTitle(''); setMessage(''); setLink(''); setStates([]); setSchools([]); setSearch('');
      refreshHistory();
    } catch (e: any) {
      setResult({ ok: false, text: e?.message || 'Could not send the notification' });
    } finally {
      setSending(false);
    }
  };

  const recall = async (h: HistoryEntry) => {
    if (!window.confirm(`Recall "${h.title}"?\n\nIt disappears from the bell of all ${fmt(h.recipients)} school${h.recipients === 1 ? '' : 's'} it was sent to. This can't be undone.`)) return;
    const key = `${h.sentAt}|${h.title}`;
    setRecalling(key);
    try {
      const res = await authFetch('/api/dashboard/school-notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentAt: h.sentAt, title: h.title }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || 'Could not recall the notification');
      setResult({ ok: true, text: `Recalled "${h.title}" from ${fmt(j.recalled)} school${j.recalled === 1 ? '' : 's'}.` });
      refreshHistory();
    } catch (e: any) {
      setResult({ ok: false, text: e?.message || 'Could not recall the notification' });
    } finally {
      setRecalling(null);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-green-300 focus:border-green-400 outline-none bg-white';
  const labelCls = 'text-xs font-bold text-gray-500 uppercase tracking-wide';

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#009846] to-emerald-600 flex items-center justify-center shadow-lg shadow-green-200">
          <Bell className="text-white" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">School Notifications</h1>
          <p className="text-sm text-gray-400">Send a message to the notification bell in schools&apos; School Panel.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[13px] text-blue-900">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <p>
          Schools are also notified automatically when their <b>student passports are released</b> and when <b>new Olympiad IDs are sent</b> to them.
          To reach app users (students, parents, teachers) as well, use <b>App Notifications</b>.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        {/* Compose */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <label className={labelCls}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={NOTIFICATION_LIMITS.title} placeholder="e.g. Exam date update" className={`${inputCls} mt-1`} />
            <p className="mt-1 text-[11px] text-gray-400 text-right">{title.length}/{NOTIFICATION_LIMITS.title}</p>
          </div>
          <div>
            <label className={labelCls}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={NOTIFICATION_LIMITS.message} rows={4} placeholder="What should the school know?" className={`${inputCls} mt-1 resize-y`} />
            <p className="mt-1 text-[11px] text-gray-400 text-right">{message.length}/{NOTIFICATION_LIMITS.message}</p>
          </div>
          <div>
            <label className={labelCls}>Opens (optional)</label>
            <select value={link} onChange={e => setLink(e.target.value)} className={`${inputCls} mt-1`}>
              {PANEL_LINKS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-gray-400">The School Panel page the school lands on when it clicks the notification.</p>
          </div>

          <div>
            <label className={labelCls}>Send to</label>
            <div className="mt-1 flex gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1 w-fit">
              {([['ALL', 'All schools'], ['STATE', 'By state'], ['SCHOOLS', 'Chosen schools']] as [Mode, string][]).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${mode === m ? 'bg-white shadow-sm text-[#009846]' : 'text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {pickerError && (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-600"><AlertCircle size={13} /> Could not load schools. Refresh the page to try again.</p>
            )}

            {mode === 'STATE' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {(picker?.states ?? []).map(s => (
                  <button key={s.state} type="button" onClick={() => toggleState(s.state)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${states.includes(s.state) ? 'bg-[#009846] border-[#009846] text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {s.state} <span className="opacity-70">({fmt(s.count)})</span>
                  </button>
                ))}
                {!picker && !pickerError && <Loader2 size={16} className="animate-spin text-gray-300" />}
                {picker && picker.states.length === 0 && <p className="text-xs text-gray-400">No active school has a state set.</p>}
              </div>
            )}

            {mode === 'SCHOOLS' && (
              <div className="mt-3 space-y-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search school name or code…" className={`${inputCls} pl-9`} />
                </div>
                {debounced && picker && picker.schools.length === 0 && (
                  <p className="text-xs text-gray-400">No active school matches &ldquo;{debounced}&rdquo;.</p>
                )}
                {debounced && (picker?.schools ?? []).length > 0 && (
                  <ul className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-52 overflow-y-auto">
                    {picker!.schools.map(s => {
                      const picked = schools.some(p => p.schoolId === s.schoolId);
                      return (
                        <li key={s.schoolId}>
                          <button type="button" onClick={() => addSchool(s)} disabled={picked}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 cursor-pointer disabled:cursor-default disabled:opacity-50">
                            <p className="text-[13px] font-bold text-gray-800 truncate">{s.name}{picked && <span className="ml-1.5 text-[11px] font-semibold text-[#009846]">added</span>}</p>
                            <p className="text-[11px] text-gray-400">{[s.schoolId, s.city, s.state].filter(Boolean).join(' · ')}</p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {schools.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {schools.map(s => (
                      <span key={s.schoolId} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-semibold text-green-800">
                        {s.name}
                        <button type="button" onClick={() => setSchools(prev => prev.filter(p => p.schoolId !== s.schoolId))} aria-label={`Remove ${s.name}`} className="p-0.5 rounded-full hover:bg-green-100 cursor-pointer"><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {targetReady && reach != null && (
              <p className="mt-3 text-[13px] text-gray-600">
                Reaches <b className="text-gray-900">{fmt(reach)}</b> active school{reach === 1 ? '' : 's'}.
              </p>
            )}
          </div>

          {/* What the school will see */}
          {(title.trim() || message.trim()) && (
            <div>
              <label className={labelCls}>Preview in the school&apos;s bell</label>
              <div className="mt-1 flex gap-3 rounded-xl border border-gray-200 bg-[#F8F9FB] px-4 py-3">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#EEF3FC] text-[#1559C7]"><Megaphone size={15} /></span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F1B2D]">{title.trim() || 'Title'}</p>
                  <p className="mt-0.5 whitespace-pre-line text-[12.5px] text-[#475265]">{message.trim() || 'Message'}</p>
                  <p className="mt-1 text-[11px] text-[#8A93A3]">Just now{link && <> · opens {linkLabel(link)}</>}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button onClick={send} disabled={!canSend}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#009846] text-white text-sm font-bold shadow-md hover:bg-[#007d3a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send notification
            </button>
            {result && (
              <span className={`text-sm font-semibold ${result.ok ? 'text-emerald-700' : 'text-red-600'}`}>
                {result.ok ? <CheckCircle2 size={14} className="inline mr-1 -mt-0.5" /> : <AlertCircle size={14} className="inline mr-1 -mt-0.5" />}{result.text}
              </span>
            )}
          </div>
        </div>

        {/* Sent */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone size={16} className="text-gray-400" />
            <h2 className="text-sm font-bold text-gray-700">Recently sent</h2>
          </div>
          {histError ? (
            <p className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle size={14} /> Could not load sent notifications.</p>
          ) : !hist ? (
            <Loader2 size={18} className="animate-spin text-gray-300" />
          ) : hist.history.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing sent yet.</p>
          ) : (
            <ul className="space-y-3">
              {hist.history.map(h => {
                const key = `${h.sentAt}|${h.title}`;
                const pct = h.recipients ? Math.round((h.read / h.recipients) * 100) : 0;
                return (
                  <li key={key} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 min-w-0 text-[13px] font-bold text-gray-800">{h.title}</p>
                      <button onClick={() => recall(h)} disabled={recalling === key} title="Recall from every school"
                        className="flex-shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50">
                        {recalling === key ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{h.message}</p>
                    {h.link && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-gray-400"><ExternalLink size={10} /> {linkLabel(h.link)}</p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      {new Date(h.sentAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}{fmt(h.recipients)} school{h.recipients === 1 ? '' : 's'} · {fmt(h.read)} read ({pct}%)
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
