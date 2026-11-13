'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Megaphone, Send, AlertCircle, CheckCircle2, X, Info, Users, Trash2, Globe, Smartphone, ChevronRight,
} from 'lucide-react';
import {
  ANNOUNCEMENT_CLASSES, ANNOUNCEMENT_LIMITS, ANNOUNCEMENT_TYPES, APP_LINK_OPTIONS, linkProblem,
  type AnnouncementFilters, type AnnouncementType,
} from '@/lib/appAnnouncementShared';

// SuperAdmin → App Notifications: send a message to a chosen set of app users.
// It lands in their app notification list (Olympiad schools also get it in
// their web School Panel bell). Server side: src/lib/appAnnouncements.ts.

interface Place { state: string; districts: string[] }
interface Preview { total: number; byType: Partial<Record<AnnouncementType, number>>; webSchools: number; message?: string }
interface Sent {
  id: string; title: string; message: string; link: string | null;
  filters: AnnouncementFilters; appRecipients: number; webRecipients: number;
  appRead: number; webRead: number; createdByName: string | null; createdAt: string;
  recalledAt: string | null; recalledBy: string | null;
}

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path: string, method = 'GET', body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

const typeLabel = (k: string) => ANNOUNCEMENT_TYPES.find((t) => t.key === k)?.label ?? k;
const classLabel = (c: string) => ANNOUNCEMENT_CLASSES.find((x) => x.code === c)?.label ?? c;
const linkLabel = (link: string | null) => {
  if (!link) return null;
  return APP_LINK_OPTIONS.find((o) => o.value === link)?.label ?? link;
};
const fmt = (n: number) => n.toLocaleString('en-IN');

/** "General User, Olympiad Student · Rajasthan · Nursery, LKG" */
function filterSummary(f: AnnouncementFilters) {
  const parts = [f.types.map(typeLabel).join(', ')];
  if (f.states.length) parts.push(f.states.join(', '));
  if (f.districts.length) parts.push(f.districts.join(', '));
  if (f.classes.length) parts.push(`Class: ${f.classes.map(classLabel).join(', ')}`);
  return parts.join(' · ');
}

// ── Small pieces ────────────────────────────────────────────────────────────

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${on ? 'bg-[#004f9f] text-white border-[#004f9f]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#004f9f]/40'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      {children}
    </button>
  );
}

/** Pick several values from a list: a dropdown to add, chips to remove. */
function MultiPick({ placeholder, options, value, onChange, disabled }: {
  placeholder: string; options: string[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean;
}) {
  const left = options.filter((o) => !value.includes(o));
  return (
    <div className="space-y-1.5">
      <select value="" disabled={disabled || left.length === 0}
        onChange={(e) => { if (e.target.value) onChange([...value, e.target.value]); }}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#004f9f] disabled:opacity-50">
        <option value="">{left.length ? placeholder : 'Nothing more to add'}</option>
        {left.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#004f9f] text-xs font-semibold">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))}><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{children}</p>;
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function AppNotificationsPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [history, setHistory] = useState<Sent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [types, setTypes] = useState<AnnouncementType[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [linkChoice, setLinkChoice] = useState('');
  const [url, setUrl] = useState('');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [sentNote, setSentNote] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const d = await api('/api/dashboard/app-notifications');
      setHistory(d.history ?? []);
      setPlaces(d.places ?? []);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const studentsOn = types.includes('OLYMPIAD_STUDENT');
  const filters: AnnouncementFilters = useMemo(() => ({
    types, states, districts, classes: studentsOn ? classes : [],
  }), [types, states, districts, classes, studentsOn]);

  // Districts of the chosen states (all states' when none is chosen).
  const districtOptions = useMemo(() => {
    const pool = states.length ? places.filter((p) => states.includes(p.state)) : places;
    return [...new Set(pool.flatMap((p) => p.districts))].sort((a, b) => a.localeCompare(b));
  }, [places, states]);
  // A district whose state was removed drops out.
  useEffect(() => {
    setDistricts((prev) => prev.filter((d) => districtOptions.includes(d)));
  }, [districtOptions]);

  // Live count of who it will reach.
  const seq = useRef(0);
  useEffect(() => {
    if (types.length === 0) { setPreview(null); return; }
    const mine = ++seq.current;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      api('/api/dashboard/app-notifications/preview', 'POST', { filters })
        .then((d) => { if (mine === seq.current) setPreview(d); })
        .catch(() => { if (mine === seq.current) setPreview(null); })
        .finally(() => { if (mine === seq.current) setPreviewLoading(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [filters, types.length]);

  const link = linkChoice === 'url' ? url.trim() : linkChoice;
  const reach = (preview?.total ?? 0) + (preview?.webSchools ?? 0);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const send = async () => {
    setFormError('');
    setSentNote('');
    if (types.length === 0) { setFormError('Pick at least one type of user.'); return; }
    if (!title.trim() || !message.trim()) { setFormError('Write a title and a message.'); return; }
    const badLink = linkProblem(link);
    if (badLink) { setFormError(badLink); return; }
    if (!preview || reach === 0) { setFormError('No one matches these filters.'); return; }
    const who = [
      preview.total ? `${fmt(preview.total)} people in the app` : '',
      preview.webSchools ? `${fmt(preview.webSchools)} Olympiad school${preview.webSchools === 1 ? '' : 's'} on the School Panel` : '',
    ].filter(Boolean).join(' and ');
    if (!confirm(`Send "${title.trim()}" to ${who}?\n\nIt appears in their notifications straight away.`)) return;
    setSending(true);
    try {
      const r = await api('/api/dashboard/app-notifications', 'POST', { title, message, link, filters });
      setSentNote(`Sent to ${fmt(r.appRecipients)} in the app${r.webRecipients ? ` and ${fmt(r.webRecipients)} school panel${r.webRecipients === 1 ? '' : 's'}` : ''}.`);
      setTitle(''); setMessage(''); setLinkChoice(''); setUrl('');
      await load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSending(false);
    }
  };

  const recall = async (s: Sent) => {
    if (!confirm(`Delete "${s.title}" for everyone?\n\nIt disappears from every app user's notifications and every school's panel. This can't be undone.`)) return;
    try {
      await api(`/api/dashboard/app-notifications/${s.id}`, 'DELETE');
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">App Notifications</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Send a message to the people you choose. It appears in the bell of their Mittmee app (Olympiad schools also get it in their web School Panel).
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : loadError ? (
        <div className="py-16 flex flex-col items-center gap-2 text-red-500 text-sm"><AlertCircle size={18} /> {loadError}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">
            {/* ── Compose ── */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-5">
              <div>
                <Label>1. Who gets it</Label>
                <div className="flex flex-wrap gap-2">
                  {ANNOUNCEMENT_TYPES.map((t) => (
                    <Chip key={t.key} on={types.includes(t.key)} onClick={() => setTypes(toggle(types, t.key))}>{t.label}</Chip>
                  ))}
                  <Chip on={types.length === ANNOUNCEMENT_TYPES.length}
                    onClick={() => setTypes(types.length === ANNOUNCEMENT_TYPES.length ? [] : ANNOUNCEMENT_TYPES.map((t) => t.key))}>
                    Everyone
                  </Chip>
                </div>
              </div>

              <div>
                <Label>2. Narrow it down (optional)</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 mb-1">State</p>
                    <MultiPick placeholder="Every state — add one to narrow" options={places.map((p) => p.state)} value={states} onChange={setStates} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 mb-1">District</p>
                    <MultiPick placeholder="Every district — add one to narrow" options={districtOptions} value={districts} onChange={setDistricts} />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">Olympiad class <span className="font-normal text-gray-400">(Olympiad students only)</span></p>
                  <div className="flex flex-wrap gap-2">
                    {ANNOUNCEMENT_CLASSES.map((c) => (
                      <Chip key={c.code} on={studentsOn && classes.includes(c.code)} disabled={!studentsOn}
                        onClick={() => setClasses(toggle(classes, c.code))}>{c.label}</Chip>
                    ))}
                  </div>
                </div>
                {(states.length > 0 || districts.length > 0) && types.includes('NORMAL') && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    General users only have a state / district if they have joined a school, so the others are left out while a place is chosen.
                  </p>
                )}
              </div>

              <div>
                <Label>3. Message</Label>
                <div className="space-y-3">
                  <div>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={ANNOUNCEMENT_LIMITS.title}
                      placeholder="Title, e.g. Olympiad results are out!"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#004f9f]" />
                    <p className="text-[10px] text-gray-400 text-right mt-0.5">{title.length}/{ANNOUNCEMENT_LIMITS.title}</p>
                  </div>
                  <div>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={ANNOUNCEMENT_LIMITS.message} rows={4}
                      placeholder="The message people will read."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#004f9f] resize-none" />
                    <p className="text-[10px] text-gray-400 text-right mt-0.5">{message.length}/{ANNOUNCEMENT_LIMITS.message}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-gray-500 mb-1">When they tap it, open</p>
                      <select value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#004f9f]">
                        {APP_LINK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    {linkChoice === 'url' && (
                      <div>
                        <p className="text-[11px] font-semibold text-gray-500 mb-1">Website link</p>
                        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.mittmee.com/…"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#004f9f]" />
                      </div>
                    )}
                  </div>
                  {linkChoice.startsWith('app://') && types.includes('OLYMPIAD_SCHOOL') && (
                    <p className="flex items-start gap-1.5 text-[11px] text-gray-500">
                      <Info size={12} className="mt-0.5 shrink-0" />
                      The School Panel on the web can&apos;t open app screens, so schools see the message there without the link.
                    </p>
                  )}
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertCircle size={13} className="shrink-0" /> {formError}
                </div>
              )}
              {sentNote && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  <CheckCircle2 size={13} className="shrink-0" /> {sentNote}
                </div>
              )}

              <button onClick={send} disabled={sending || !types.length || !title.trim() || !message.trim() || !reach}
                className="w-full py-3 bg-[#004f9f] text-white text-sm font-bold rounded-xl hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2">
                {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {sending ? 'Sending…' : reach ? `Send to ${fmt(reach)}` : 'Send'}
              </button>
            </div>

            {/* ── Reach + preview ── */}
            <div className="space-y-4 xl:sticky xl:top-4">
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5"><Users size={11} /> Who it reaches</p>
                {types.length === 0 ? (
                  <p className="text-xs text-gray-400">Pick a type of user to see how many people get it.</p>
                ) : previewLoading && !preview ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : preview ? (
                  <div className={`space-y-1.5 ${previewLoading ? 'opacity-50' : ''}`}>
                    <p className="text-2xl font-black text-[#004f9f]">{fmt(preview.total)} <span className="text-xs font-semibold text-gray-400">in the app</span></p>
                    {ANNOUNCEMENT_TYPES.filter((t) => types.includes(t.key)).map((t) => (
                      <div key={t.key} className="flex justify-between text-xs text-gray-600">
                        <span className="flex items-center gap-1.5"><Smartphone size={11} className="text-gray-400" /> {t.label}</span>
                        <span className="font-semibold">{fmt(preview.byType[t.key] ?? 0)}</span>
                      </div>
                    ))}
                    {types.includes('OLYMPIAD_SCHOOL') && (
                      <div className="flex justify-between text-xs text-gray-600 pt-1 border-t border-gray-100">
                        <span className="flex items-center gap-1.5"><Globe size={11} className="text-gray-400" /> School Panel (web)</span>
                        <span className="font-semibold">{fmt(preview.webSchools)}</span>
                      </div>
                    )}
                    {reach === 0 && <p className="text-[11px] text-red-500">No one matches these filters.</p>}
                  </div>
                ) : null}
              </div>

              <div className="bg-[#FBF6EE] border border-gray-100 rounded-2xl shadow-sm p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">How it looks in the app</p>
                <div className="bg-white rounded-2xl p-3 flex gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-amber-50 border border-amber-200">
                    <Megaphone size={17} className="text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2">
                      <p className="text-sm font-bold text-gray-800 truncate">{title.trim() || 'Your title'}</p>
                      <span className="text-[10px] text-gray-400 shrink-0">Now</span>
                    </div>
                    <p className="text-xs text-gray-600 whitespace-pre-line break-words mt-0.5">{message.trim() || 'Your message appears here.'}</p>
                    {link && (
                      <span className="inline-flex items-center gap-0.5 mt-2 px-2.5 py-1 rounded-full bg-[#1FAE8E] text-white text-[11px] font-bold">
                        Open <ChevronRight size={11} />
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Shown in the bell under All and Alerts, with a red dot until read.</p>
              </div>
            </div>
          </div>

          {/* ── History ── */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Megaphone size={14} className="text-[#004f9f]" />
              <p className="text-sm font-bold text-gray-700">Sent</p>
              <span className="text-xs text-gray-400">latest {history.length}</span>
            </div>
            {history.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">Nothing sent yet.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {history.map((s) => {
                  const total = s.appRecipients + s.webRecipients;
                  const read = s.appRead + s.webRead;
                  return (
                    <div key={s.id} className={`px-5 py-3 flex gap-4 items-start ${s.recalledAt ? 'opacity-60' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 flex items-center gap-2 flex-wrap">
                          {s.title}
                          {s.recalledAt && <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200 rounded">Deleted for everyone</span>}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{s.message}</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {filterSummary(s.filters)}
                          {s.link ? ` · opens ${linkLabel(s.link)}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0 w-44">
                        <p className="text-xs text-gray-600">
                          <span className="font-bold">{fmt(total)}</span> reached
                          {!s.recalledAt && <> · <span className="font-bold">{fmt(read)}</span> read{total ? ` (${Math.round((read / total) * 100)}%)` : ''}</>}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(s.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                          {s.createdByName ? ` · ${s.createdByName}` : ''}
                        </p>
                        {!s.recalledAt && (
                          <button onClick={() => recall(s)}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 hover:underline">
                            <Trash2 size={11} /> Delete for everyone
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
