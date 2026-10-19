'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Plus, X, Trash2, AlertCircle, Pencil, Copy, Palette, CalendarClock, Info,
  UploadCloud, ArrowUp, ArrowDown, Eye, EyeOff, Sparkles, Smartphone, Power, Image as ImageIcon,
} from 'lucide-react';
import { authFetch } from '@/lib/swr';
import {
  appThemeConfigSchema, DEFAULT_THEME_CONFIG, THEME_PRESETS, THEME_ICONS, SECTION_LABELS, APP_LINK_SCREENS,
  type AppThemeConfig,
} from '@/lib/appThemeConfig';

// SuperAdmin → App Theme & Festivals. Each theme is a scheduled look for the
// mobile app home screen. The app picks up the live one on its next launch /
// return to foreground (about a minute at most) — no app update needed.

interface ThemeRow {
  id: string;
  name: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  updatedAt: string;
  bannerCount: number;
  config: AppThemeConfig;
}

type Status = 'live' | 'scheduled' | 'ended' | 'off' | 'overridden';

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  live: { label: 'Live now', cls: 'bg-green-50 text-green-700 border-green-200' },
  scheduled: { label: 'Scheduled', cls: 'bg-blue-50 text-[#004f9f] border-blue-200' },
  overridden: { label: 'Waiting (lower priority)', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ended: { label: 'Ended', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  off: { label: 'Off', cls: 'bg-red-50 text-red-600 border-red-200' },
};

function statusOf(t: ThemeRow, liveId: string | null): Status {
  const now = Date.now();
  if (!t.isActive) return 'off';
  if (t.id === liveId) return 'live';
  if (t.endsAt && new Date(t.endsAt).getTime() <= now) return 'ended';
  if (t.startsAt && new Date(t.startsAt).getTime() > now) return 'scheduled';
  return 'overridden';
}

// <input type="datetime-local"> works in local time without a zone.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}
function fmtWhen(iso: string | null, fallback: string) {
  return iso
    ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : fallback;
}

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await authFetch('/api/dashboard/banners/upload', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Upload failed');
  return data.imageUrl as string;
}

// Rough web stand-ins for the app's Ionicons, for the preview only.
const GLYPH: Record<string, string> = {
  star: '★', 'star-outline': '☆', sparkles: '✨', 'sparkles-outline': '✧', heart: '♥', 'heart-outline': '♡',
  flower: '✿', 'flower-outline': '❀', rose: '🌹', leaf: '🍃', snow: '❄', 'snow-outline': '❅', moon: '☾',
  sunny: '☀', flame: '🔥', bonfire: '🔥', gift: '🎁', balloon: '🎈', 'color-palette': '🎨', ellipse: '●',
  'musical-notes': '♫', diamond: '◆', planet: '🪐', trophy: '🏆', ribbon: '🎗', water: '💧', cloud: '☁',
  rocket: '🚀', happy: '☺', 'shield-checkmark': '🛡', school: '🎓', medal: '🏅', flag: '⚑', megaphone: '📣', calendar: '📅',
};
const glyph = (v: string) => GLYPH[v] ?? v;

const DEFAULT_DECOR = ['star', 'sparkles', 'star-outline'];
const DEFAULT_DECOR_COLORS = ['#F0729A', '#F5A623', '#3E82E0', '#8A6FCB', '#1FAE8E'];
const PARTICLES = { low: 8, medium: 14, high: 20 } as const;
// Same scatter as the app's HOME_SPARKLES.
const SPOTS = [
  [3, 6], [2, 88], [10, 76], [24, 3], [31, 93], [42, 10], [48, 84], [58, 4], [66, 91], [76, 8], [84, 78], [93, 14],
];

// ═════════════════════════════════════════════════════════════════════════════
export default function AppThemePage() {
  const [rows, setRows] = useState<ThemeRow[]>([]);
  const [liveId, setLiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<Partial<ThemeRow> | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError('');
    authFetch('/api/dashboard/app-themes')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Failed to load themes');
        setRows(data.themes || []);
        setLiveId(data.liveId ?? null);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const live = rows.find((r) => r.id === liveId) ?? null;

  const toggleActive = async (t: ThemeRow) => {
    const res = await authFetch(`/api/dashboard/app-themes/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.message || 'Failed to update'); return; }
    load();
  };

  const remove = async (t: ThemeRow) => {
    const extra = t.bannerCount ? `\n\nIts ${t.bannerCount} festival carousel slide(s) will be hidden (not deleted).` : '';
    if (!confirm(`Delete the theme "${t.name}"?${extra}`)) return;
    const res = await authFetch(`/api/dashboard/app-themes/${t.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'Failed to delete');
      return;
    }
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">App Theme &amp; Festivals</h1>
          <p className="text-xs text-gray-400 mt-0.5">Change the look of the mobile app home screen for festivals — no app update needed</p>
        </div>
        <button onClick={() => setEditing({})}
          className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a] transition-colors">
          <Plus size={15} /> New Theme
        </button>
      </div>

      <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${live ? 'bg-green-50 border-green-100 text-green-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
        <Info size={14} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          {live ? (
            <p><strong>{live.name}</strong> is live in the app right now{live.endsAt ? ` until ${fmtWhen(live.endsAt, '')}` : ''}.</p>
          ) : (
            <p>No theme is live — the app is showing its <strong>standard Mittmee look</strong>.</p>
          )}
          <p className="opacity-80">
            A theme goes live on its own between its start and end time. If two overlap, the higher priority wins.
            Phones pick up changes within about a minute. Festival-only carousel slides are added in <strong>App Carousel</strong> → “Show during”.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : loadError ? (
          <div className="py-16 flex flex-col items-center gap-2 text-red-500 text-sm"><AlertCircle size={18} /> {loadError}</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-gray-400 text-sm">No themes yet. Start from a festival:</p>
            <div className="flex flex-wrap justify-center gap-2 px-6">
              {THEME_PRESETS.filter((p) => p.id !== 'classic').map((p) => (
                <button key={p.id}
                  onClick={() => setEditing({ name: p.name, config: appThemeConfigSchema.parse(p.config) })}
                  className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#004f9f] hover:text-[#004f9f]">
                  {p.emoji} {p.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {rows.map((t) => {
              const st = STATUS_META[statusOf(t, liveId)];
              const c = t.config.colors;
              return (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="w-16 h-10 rounded-lg border border-gray-100 shrink-0 overflow-hidden relative"
                    style={{ background: `linear-gradient(135deg, ${c.bg.join(', ')})` }}>
                    <span className="absolute left-1 bottom-1 w-6 h-2 rounded-full" style={{ background: c.accent }} />
                    <span className="absolute right-1 top-1 text-xs leading-none">
                      {t.config.hero.emoji || glyph(t.config.decor.icons[0] ?? '')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 font-medium truncate">{t.name}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <CalendarClock size={11} />
                      {fmtWhen(t.startsAt, 'As soon as switched on')} → {fmtWhen(t.endsAt, 'until switched off')}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                      <span>Priority {t.priority}</span>
                      {t.bannerCount > 0 && <span>· {t.bannerCount} festival slide{t.bannerCount === 1 ? '' : 's'}</span>}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setEditing(t)} title="Edit"
                      className="p-1.5 rounded-lg bg-[#004f9f]/5 text-[#004f9f] hover:bg-[#004f9f]/10"><Pencil size={13} /></button>
                    <button onClick={() => setEditing({ ...t, id: undefined, name: `${t.name} (copy)`, isActive: false })} title="Duplicate"
                      className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><Copy size={13} /></button>
                    <button onClick={() => toggleActive(t)} title={t.isActive ? 'Switch off' : 'Switch on'}
                      className={`p-1.5 rounded-lg ${t.isActive ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                      <Power size={13} />
                    </button>
                    <button onClick={() => remove(t)} title="Delete"
                      className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <ThemeEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
const TABS = [
  { key: 'basics', label: 'Schedule' },
  { key: 'hero', label: 'Festive top' },
  { key: 'colors', label: 'Page look' },
  { key: 'header', label: 'Header' },
  { key: 'decor', label: 'Decorations' },
  { key: 'sections', label: 'Home sections' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function ThemeEditor({ initial, onClose, onSaved }: {
  initial: Partial<ThemeRow>; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!initial.id;
  const [tab, setTab] = useState<TabKey>('basics');
  const [name, setName] = useState(initial.name ?? '');
  const [isActive, setIsActive] = useState(initial.isActive ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(initial.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial.endsAt ?? null));
  const [priority, setPriority] = useState(initial.priority ?? 0);
  const [config, setConfig] = useState<AppThemeConfig>(
    initial.config ? appThemeConfigSchema.parse(initial.config) : DEFAULT_THEME_CONFIG,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends Exclude<keyof AppThemeConfig, 'sections'>>(key: K, patch: Partial<AppThemeConfig[K]>) =>
    setConfig((c) => ({ ...c, [key]: { ...c[key], ...patch } }));

  const applyPreset = (id: string) => {
    const p = THEME_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setConfig(appThemeConfigSchema.parse(p.config));
    if (!name.trim() || THEME_PRESETS.some((x) => x.name === name)) setName(p.name);
  };

  const save = async () => {
    setError('');
    const parsed = appThemeConfigSchema.safeParse(config);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      setError(`${i.path.join(' › ')}: ${i.message}`);
      return;
    }
    if (!name.trim()) { setError('Give the theme a name'); setTab('basics'); return; }
    setSaving(true);
    try {
      const body = JSON.stringify({
        name, isActive, priority: Number(priority) || 0,
        startsAt: fromLocalInput(startsAt), endsAt: fromLocalInput(endsAt),
        config: parsed.data,
      });
      const res = isEdit
        ? await authFetch(`/api/dashboard/app-themes/${initial.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body })
        : await authFetch('/api/dashboard/app-themes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Save failed');
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">{isEdit ? 'Edit Theme' : 'New Theme'}</p>
            <p className="text-white font-bold text-sm mt-0.5">{name || 'Untitled theme'}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px]">
          {/* ── Form ── */}
          <div className="min-h-0 overflow-y-auto p-5 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 flex items-center gap-1.5">
                <Sparkles size={11} /> Start from a festival preset
              </p>
              <div className="flex flex-wrap gap-1.5">
                {THEME_PRESETS.map((p) => (
                  <button key={p.id} onClick={() => applyPreset(p.id)}
                    className="px-2.5 py-1 rounded-full border border-gray-200 text-[11px] font-semibold text-gray-600 hover:border-[#004f9f] hover:text-[#004f9f]">
                    {p.emoji} {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? 'border-[#004f9f] text-[#004f9f]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'basics' && (
              <div className="space-y-4">
                <Field label="Theme name">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diwali 2026" maxLength={60} className={INPUT} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Starts" hint="Blank = as soon as it's switched on">
                    <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={INPUT} />
                  </Field>
                  <Field label="Ends" hint="Blank = until switched off">
                    <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={INPUT} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Priority" hint="When themes overlap, the higher number wins">
                    <input type="number" min={-100} max={100} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={INPUT} />
                  </Field>
                  <Field label="Switched on">
                    <Toggle checked={isActive} onChange={setIsActive} label={isActive ? 'On — goes live in its time window' : 'Off — never shown'} />
                  </Field>
                </div>
              </div>
            )}

            {tab === 'hero' && (
              <HeroEditor value={config.hero} onChange={(patch) => set('hero', patch)} />
            )}

            {tab === 'colors' && (
              <div className="space-y-4">
                <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  These recolour the <strong>whole</strong> home page. For a festival, the <strong>Festive top</strong> tab is usually all you need —
                  leave these as they are to keep the normal Mittmee look (like Amazon or Swiggy do).
                </p>
                <PaletteField label="Page background (gradient)" value={config.colors.bg} min={2} max={3} onChange={(bg) => set('colors', { bg })} />
                <PaletteField label="Header background (gradient)" value={config.colors.header} min={2} max={3} onChange={(header) => set('colors', { header })} />
                <PaletteField label="Header glows (left, right)" value={config.colors.glow} min={2} max={2} onChange={(glow) => set('colors', { glow })} />
                <PaletteField label="Header bottom stripe" value={config.colors.divider} min={2} max={6} onChange={(divider) => set('colors', { divider })} />
                <PaletteField label='Logo text ("mitt", "mee")' value={config.colors.brand} min={2} max={2} onChange={(brand) => set('colors', { brand })} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Primary"><ColorInput value={config.colors.primary} onChange={(primary) => set('colors', { primary })} /></Field>
                  <Field label="Accent (tagline, dots)"><ColorInput value={config.colors.accent} onChange={(accent) => set('colors', { accent })} /></Field>
                  <Field label="Text on accent"><ColorInput value={config.colors.accentText} onChange={(accentText) => set('colors', { accentText })} /></Field>
                </div>
                <Field label="Status bar icons">
                  <select value={config.colors.statusBar} onChange={(e) => set('colors', { statusBar: e.target.value as 'dark' | 'light' })} className={INPUT}>
                    <option value="dark">Dark (for light backgrounds)</option>
                    <option value="light">Light (for dark backgrounds)</option>
                  </select>
                </Field>
                <Field label="Background image (optional)" hint="Shown behind the whole home screen, under the videos">
                  <ImageInput value={config.background.imageUrl} onChange={(imageUrl) => set('background', { imageUrl })} />
                </Field>
                {config.background.imageUrl && (
                  <>
                    <Field label="How to show it">
                      <Segmented
                        value={config.background.fit}
                        onChange={(fit) => set('background', { fit })}
                        options={[['cover', 'Full picture', 'One image stretched over the page'], ['tile', 'Repeating pattern', 'Small image tiled, e.g. rangoli']]}
                      />
                    </Field>
                    <Field label={`Strength: ${Math.round(config.background.opacity * 100)}%`} hint="Keep it soft so videos and text stay readable — 20–40% works well">
                      <input type="range" min={5} max={100} value={Math.round(config.background.opacity * 100)}
                        onChange={(e) => set('background', { opacity: Number(e.target.value) / 100 })} className="w-full" />
                    </Field>
                  </>
                )}
              </div>
            )}

            {tab === 'header' && (
              <div className="space-y-4">
                <Field label="Subtitle under the logo">
                  <input value={config.header.subtitle} maxLength={40} onChange={(e) => set('header', { subtitle: e.target.value })} className={INPUT} />
                </Field>
                <Field label="Tagline pill">
                  <input value={config.header.tagline} maxLength={60} onChange={(e) => set('header', { tagline: e.target.value })} className={INPUT} />
                </Field>
                <Field label="Tagline icon">
                  <IconPicker value={config.header.taglineIcon} onChange={(taglineIcon) => set('header', { taglineIcon })} />
                </Field>
                <Field label="Header art (optional)" hint="Small transparent PNG shown on the header's right, e.g. diyas or a Santa hat">
                  <ImageInput value={config.header.artUrl} onChange={(artUrl) => set('header', { artUrl })} />
                </Field>
              </div>
            )}

            {tab === 'decor' && (
              <div className="space-y-4">
                <Field label="Style">
                  <div className="grid grid-cols-3 gap-2">
                    {([['none', 'None'], ['static', 'Scattered'], ['fall', 'Falling (animated)']] as const).map(([k, l]) => (
                      <button key={k} onClick={() => set('decor', { effect: k })}
                        className={`py-2 rounded-lg border text-xs font-semibold ${config.decor.effect === k ? 'border-[#004f9f] bg-[#004f9f]/5 text-[#004f9f]' : 'border-gray-200 text-gray-500'}`}>{l}</button>
                    ))}
                  </div>
                </Field>
                {config.decor.effect !== 'none' && (
                  <>
                    <Field label="Decorations" hint="Up to 8 — pick icons or type any emoji. Empty = the usual stars.">
                      <DecorPicker value={config.decor.icons} onChange={(icons) => set('decor', { icons })} />
                    </Field>
                    <PaletteField label="Decoration colours (icons only — emoji keep their own)" value={config.decor.colors} min={0} max={8} onChange={(colors) => set('decor', { colors })} />
                    {config.decor.effect === 'fall' && (
                      <Field label="Amount">
                        <select value={config.decor.density} onChange={(e) => set('decor', { density: e.target.value as 'low' | 'medium' | 'high' })} className={INPUT}>
                          <option value="low">A few</option>
                          <option value="medium">Some</option>
                          <option value="high">Lots</option>
                        </select>
                      </Field>
                    )}
                    <div className="flex flex-wrap gap-4">
                      <Toggle checked={config.decor.clouds} onChange={(clouds) => set('decor', { clouds })} label="Clouds" />
                      <Toggle checked={config.decor.puzzles} onChange={(puzzles) => set('decor', { puzzles })} label="Puzzle pieces" />
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'sections' && (
              <SectionsEditor value={config.sections} onChange={(sections) => setConfig((c) => ({ ...c, sections }))} />
            )}
          </div>

          {/* ── Preview ── */}
          <div className="hidden lg:flex flex-col items-center bg-gray-50 border-l border-gray-100 p-5 min-h-0 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5"><Smartphone size={11} /> Live preview</p>
            <PhonePreview config={config} />
            <p className="text-[10px] text-gray-400 mt-3 text-center">Approximate — the app draws the real icons and fonts.</p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-3 shrink-0">
          {error ? (
            <div className="flex-1 flex items-center gap-2 text-xs text-red-600"><AlertCircle size={13} /> {error}</div>
          ) : <div className="flex-1" />}
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Palette size={14} />}
            {isEdit ? 'Save Changes' : 'Create Theme'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form bits ────────────────────────────────────────────────────────────────
const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#004f9f]';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm text-gray-600">
      <span className={`w-9 h-5 rounded-full relative transition-colors ${checked ? 'bg-[#009846]' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={value.slice(0, 7)} onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white shrink-0" />
      <input value={text} maxLength={9}
        onChange={(e) => {
          setText(e.target.value);
          if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(e.target.value)) onChange(e.target.value.toUpperCase());
        }}
        className="w-24 border border-gray-200 rounded-lg px-2 py-2 text-xs font-mono focus:outline-none focus:border-[#004f9f]" />
    </div>
  );
}

function PaletteField({ label, value, min, max, onChange }: {
  label: string; value: string[]; min: number; max: number; onChange: (v: string[]) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((c, i) => (
          <div key={i} className="flex items-center gap-1">
            <ColorInput value={c} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
            {value.length > min && (
              <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><X size={13} /></button>
            )}
          </div>
        ))}
        {value.length < max && (
          <button onClick={() => onChange([...value, value[value.length - 1] ?? '#F5A623'])}
            className="w-9 h-9 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:text-[#004f9f] hover:border-[#004f9f] flex items-center justify-center">
            <Plus size={14} />
          </button>
        )}
      </div>
      {value.length > 1 && (
        <div className="h-2 rounded-full mt-2" style={{ background: `linear-gradient(90deg, ${value.join(', ')})` }} />
      )}
    </Field>
  );
}

function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: [T, string, string][];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(([k, label, hint]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`text-left px-3 py-2 rounded-lg border ${value === k ? 'border-[#004f9f] bg-[#004f9f]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
          <span className={`block text-xs font-semibold ${value === k ? 'text-[#004f9f]' : 'text-gray-600'}`}>{label}</span>
          <span className="block text-[10px] text-gray-400 mt-0.5">{hint}</span>
        </button>
      ))}
    </div>
  );
}

function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // The stored file can disappear from the server (deleted / cleaned up). Say
  // so here instead of letting the app silently show nothing.
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [value]);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className={`w-14 h-14 rounded-lg border ${broken ? 'border-red-300' : 'border-gray-200'} bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:12px_12px] overflow-hidden shrink-0 flex items-center justify-center`}>
          {busy ? <Loader2 size={16} className="animate-spin text-[#004f9f]" />
            : value && !broken ? <img src={value} alt="" className="w-full h-full object-contain" onError={() => setBroken(true)} />
            : value ? <AlertCircle size={16} className="text-red-400" />
            : <ImageIcon size={16} className="text-gray-300" />}
        </div>
        <button type="button" onClick={() => ref.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          <UploadCloud size={13} /> Upload
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-xs text-red-500 hover:underline">Remove</button>
        )}
        <input ref={ref} type="file" accept="image/png,image/webp,image/jpeg,image/gif" className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true); setErr('');
            try { onChange(await uploadImage(f)); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
          }} />
      </div>
      {err && <p className="text-[10px] text-red-500">{err}</p>}
      {broken && !busy && (
        <p className="text-[10px] text-red-500">This image is missing on the server — the app can&apos;t show it. Please upload it again.</p>
      )}
    </div>
  );
}

function LinkInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isApp = value.startsWith('app://');
  const screen = isApp ? value.slice(6).split('?')[0] : '';
  const query = isApp ? new URLSearchParams(value.split('?')[1] ?? '').get('q') ?? '' : '';
  const mode = !value ? 'none' : isApp ? 'app' : 'web';
  return (
    <div className="space-y-1.5">
      <select value={mode === 'app' ? `app:${screen}` : mode}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'none') onChange('');
          else if (v === 'web') onChange('https://');
          else onChange(`app://${v.slice(4)}`);
        }}
        className={INPUT}>
        <option value="none">Nothing (not tappable)</option>
        {APP_LINK_SCREENS.map((s) => <option key={s} value={`app:${s}`}>App: {s === 'MySchool' ? 'My School' : s} screen</option>)}
        <option value="web">A website…</option>
      </select>
      {mode === 'web' && <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" className={INPUT} />}
      {mode === 'app' && screen === 'Search' && (
        <input value={query} placeholder="Search for… (e.g. diwali)"
          onChange={(e) => onChange(`app://Search${e.target.value ? `?q=${encodeURIComponent(e.target.value)}` : ''}`)} className={INPUT} />
      )}
    </div>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {THEME_ICONS.map((i) => (
        <button key={i} title={i} onClick={() => onChange(i)}
          className={`w-8 h-8 rounded-lg border text-sm ${value === i ? 'border-[#004f9f] bg-[#004f9f]/10' : 'border-gray-200 hover:bg-gray-50'}`}>{glyph(i)}</button>
      ))}
    </div>
  );
}

function DecorPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [emoji, setEmoji] = useState('');
  const full = value.length >= 8;
  const add = (v: string) => { if (!full && v && !value.includes(v)) onChange([...value, v]); };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[34px] p-1.5 rounded-lg border border-gray-200 bg-gray-50">
        {value.length === 0 && <span className="text-xs text-gray-400 px-1 py-1">Default stars & sparkles</span>}
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full pl-2 pr-1 py-0.5 text-sm">
            {glyph(v)}
            <button onClick={() => onChange(value.filter((x) => x !== v))} className="text-gray-300 hover:text-red-500"><X size={12} /></button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {THEME_ICONS.filter((i) => i !== 'shield-checkmark' && i !== 'calendar').map((i) => (
          <button key={i} title={i} disabled={full || value.includes(i)} onClick={() => add(i)}
            className="w-8 h-8 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 disabled:opacity-30">{glyph(i)}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="Or type an emoji, e.g. 🪔" maxLength={16} className={INPUT} />
        <button disabled={full || !emoji.trim()} onClick={() => { add(emoji.trim()); setEmoji(''); }}
          className="px-3 rounded-lg bg-[#004f9f] text-white text-xs font-semibold disabled:opacity-40">Add</button>
      </div>
    </div>
  );
}

// ── Festive top editor ───────────────────────────────────────────────────────
type Hero = AppThemeConfig['hero'];
type Tile = Hero['tiles'][number];

function HeroEditor({ value: h, onChange }: { value: Hero; onChange: (patch: Partial<Hero>) => void }) {
  const setTile = (i: number, patch: Partial<Tile>) => onChange({ tiles: h.tiles.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const moveTile = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= h.tiles.length) return;
    const next = [...h.tiles];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ tiles: next });
  };
  return (
    <div className="space-y-4">
      <Toggle checked={h.enabled} onChange={(enabled) => onChange({ enabled })} label="Dress up the top of the home screen" />
      <p className="text-[11px] text-gray-400 -mt-2">
        Like Amazon, Blinkit and Swiggy: a festive colour band behind the header and carousel that melts into the normal page,
        a big festival title or artwork, and festive shortcut tiles. The rest of the app keeps its normal look.
      </p>
      {h.enabled && (
        <>
          <PaletteField label="Band colour (top → bottom)" value={h.colors} min={2} max={2} onChange={(colors) => onChange({ colors })} />
          <Toggle checked={h.followSlides} onChange={(followSlides) => onChange({ followSlides })}
            label="Band changes colour with each carousel slide (set a slide's colour in App Carousel)" />
          <Field label="Header text on the band">
            <Segmented value={h.textTone} onChange={(textTone) => onChange({ textTone })}
              options={[['dark', 'Dark text', 'For light / bright bands'], ['light', 'White text', 'For deep / dark bands']]} />
          </Field>
          <Toggle checked={h.bunting} onChange={(bunting) => onChange({ bunting })} label="Festive flags (bunting) under the header — uses the stripe colours from Page look" />

          <div className="rounded-xl border border-gray-100 p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Masthead</p>
            <Field label="Artwork (optional)" hint="A wide transparent PNG, e.g. 1080 × 360 — diyas, a Durga face, rangoli. Replaces the title below.">
              <ImageInput value={h.mastheadUrl} onChange={(mastheadUrl) => onChange({ mastheadUrl })} />
            </Field>
            {!h.mastheadUrl && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Small line"><input value={h.kicker} maxLength={24} onChange={(e) => onChange({ kicker: e.target.value.toUpperCase() })} placeholder="CELEBRATE" className={INPUT} /></Field>
                  <Field label="Big title"><input value={h.title} maxLength={28} onChange={(e) => onChange({ title: e.target.value })} placeholder="Navratri" className={INPUT} /></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Emoji either side"><input value={h.emoji} maxLength={16} onChange={(e) => onChange({ emoji: e.target.value })} placeholder="🪔" className={INPUT} /></Field>
                  <Field label="Title colour"><ColorInput value={h.textColor} onChange={(textColor) => onChange({ textColor })} /></Field>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 p-3 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Festive tiles</p>
            <Toggle checked={h.showTiles} onChange={(showTiles) => onChange({ showTiles })} label="Show festive tiles under the carousel" />
            {!h.showTiles ? (
              <p className="text-[11px] text-gray-400">Off — no tiles in the app. Switch on to set them up.</p>
            ) : (<>
            <Field label="Row title (optional)">
              <input value={h.tilesTitle} maxLength={30} onChange={(e) => onChange({ tilesTitle: e.target.value })} placeholder="Festive Picks" className={INPUT} />
            </Field>
            {h.tiles.map((t, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-2.5 space-y-2 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button onClick={() => moveTile(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-[#004f9f] disabled:opacity-20"><ArrowUp size={12} /></button>
                    <button onClick={() => moveTile(i, 1)} disabled={i === h.tiles.length - 1} className="text-gray-400 hover:text-[#004f9f] disabled:opacity-20"><ArrowDown size={12} /></button>
                  </div>
                  <input value={t.label} maxLength={24} onChange={(e) => setTile(i, { label: e.target.value })} placeholder="Label, e.g. Garba Nights" className={INPUT} />
                  <input value={t.emoji} maxLength={16} onChange={(e) => setTile(i, { emoji: e.target.value })} placeholder="💃" className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:border-[#004f9f]" />
                  <ColorInput value={t.color} onChange={(color) => setTile(i, { color })} />
                  <button onClick={() => onChange({ tiles: h.tiles.filter((_, j) => j !== i) })} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <LinkInput value={t.linkUrl} onChange={(linkUrl) => setTile(i, { linkUrl })} />
                  <ImageInput value={t.imageUrl} onChange={(imageUrl) => setTile(i, { imageUrl })} />
                </div>
              </div>
            ))}
            {h.tiles.length < 8 && (
              <button onClick={() => onChange({ tiles: [...h.tiles, { label: '', emoji: '✨', imageUrl: '', linkUrl: '', color: '#FFF4E6' }] })}
                className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs font-semibold text-gray-500 hover:text-[#004f9f] hover:border-[#004f9f] flex items-center justify-center gap-1.5">
                <Plus size={13} /> Add tile
              </button>
            )}
            <p className="text-[10px] text-gray-400">Tip: point a tile at a search (e.g. “garba”) so it opens matching videos, or at the Upload screen.</p>
            </>)}
          </div>
        </>
      )}
    </div>
  );
}

function SectionsEditor({ value, onChange }: { value: AppThemeConfig['sections']; onChange: (v: AppThemeConfig['sections']) => void }) {
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const patch = (i: number, p: Partial<AppThemeConfig['sections'][number]>) => onChange(value.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Order of the rows under the carousel. The carousel always stays on top. A row with no videos is skipped automatically.</p>
      {value.map((s, i) => (
        <div key={s.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${s.visible ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50 opacity-70'}`}>
          <div className="flex flex-col">
            <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-[#004f9f] disabled:opacity-20"><ArrowUp size={13} /></button>
            <button onClick={() => move(i, 1)} disabled={i === value.length - 1} className="text-gray-400 hover:text-[#004f9f] disabled:opacity-20"><ArrowDown size={13} /></button>
          </div>
          <span className="text-xs text-gray-400 w-4">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700">{SECTION_LABELS[s.key]}</p>
            {s.key !== 'rows' && (
              <input value={s.title} maxLength={40} onChange={(e) => patch(i, { title: e.target.value })}
                placeholder="Custom title (optional)"
                className="mt-1 w-full border border-gray-100 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-[#004f9f]" />
            )}
          </div>
          <button onClick={() => patch(i, { visible: !s.visible })} title={s.visible ? 'Hide' : 'Show'}
            className={`p-1.5 rounded-lg ${s.visible ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
            {s.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Phone preview ────────────────────────────────────────────────────────────
function PhonePreview({ config: c }: { config: AppThemeConfig }) {
  const icons = c.decor.icons.length ? c.decor.icons : DEFAULT_DECOR;
  const colors = c.decor.colors.length ? c.decor.colors : DEFAULT_DECOR_COLORS;
  const particles = useMemo(() => {
    const n = PARTICLES[c.decor.density];
    // Deterministic spread so the preview doesn't jump on every keystroke.
    return Array.from({ length: n }, (_, i) => ({
      left: (i * 37 + 11) % 96,
      dur: 7 + ((i * 53) % 7),
      delay: -((i * 29) % 11),
      size: 10 + ((i * 7) % 8),
    }));
  }, [c.decor.density]);
  const h = c.hero;
  const hero = h.enabled;
  const page = c.colors.bg[0];
  const onBandText = hero && h.textTone === 'light';
  const flags = c.colors.divider;

  return (
    <div className="relative w-[300px] h-[600px] rounded-[38px] border-[10px] border-gray-900 shadow-xl overflow-hidden shrink-0"
      style={{ background: `linear-gradient(135deg, ${c.colors.bg.join(', ')})` }}>
      <style>{`@keyframes mmFall { from { transform: translateY(-30px) rotate(0deg); } to { transform: translateY(620px) rotate(200deg); } }
        .mm-noscroll::-webkit-scrollbar { display: none; }`}</style>

      {c.background.imageUrl && (
        <div className="absolute inset-0" style={{
          backgroundImage: `url(${c.background.imageUrl})`,
          backgroundSize: c.background.fit === 'tile' ? '120px' : 'cover',
          backgroundPosition: 'center',
          opacity: c.background.opacity,
        }} />
      )}

      {/* decor */}
      {c.decor.effect !== 'none' && SPOTS.map(([top, left], i) => (
        <span key={i} className="absolute pointer-events-none" style={{ top: `${top}%`, left: `${left}%`, color: colors[i % colors.length], opacity: 0.5, fontSize: 11 + (i % 3) * 2 }}>
          {glyph(icons[i % icons.length])}
        </span>
      ))}
      {c.decor.effect === 'fall' && particles.map((p, i) => (
        <span key={`p${i}`} className="absolute top-0 pointer-events-none z-30"
          style={{ left: `${p.left}%`, fontSize: p.size, color: colors[i % colors.length], opacity: 0.75, animation: `mmFall ${p.dur}s linear ${p.delay}s infinite` }}>
          {glyph(icons[i % icons.length])}
        </span>
      ))}

      <div className="mm-noscroll absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* ── Top: header, bunting, masthead, carousel — on the band when festive ── */}
        <div className="relative">
          {hero && (
            <div className="absolute inset-x-0 top-0 bottom-[22px]"
              style={{ background: `linear-gradient(180deg, ${h.colors[0]} 0%, ${h.colors[0]} 28%, ${h.colors[1]} 72%, ${page} 100%)` }} />
          )}

          {/* header */}
          <div className={`relative z-20 px-4 pt-6 pb-3 overflow-hidden ${hero ? '' : 'shadow-sm'}`}
            style={{ background: hero ? 'transparent' : `linear-gradient(135deg, ${c.colors.header.join(', ')})` }}>
            {!hero && <>
              <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full blur-2xl" style={{ background: c.colors.glow[0], opacity: 0.22 }} />
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl" style={{ background: c.colors.glow[1], opacity: 0.25 }} />
            </>}
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white border-2 flex items-center justify-center text-[10px] font-black" style={{ borderColor: c.colors.primary, color: c.colors.brand[0] }}>m</div>
                <div>
                  <p className="text-base font-black leading-none tracking-tight">
                    <span style={{ color: onBandText ? '#fff' : c.colors.brand[0] }}>mitt</span>
                    <span style={{ color: onBandText ? '#fff' : c.colors.brand[1] }}>mee</span>
                  </p>
                  <p className="text-[8px] font-bold mt-0.5" style={{ color: hero ? (onBandText ? 'rgba(255,255,255,.85)' : 'rgba(36,30,24,.68)') : c.colors.primary }}>{c.header.subtitle}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <span className="w-7 h-7 rounded-full bg-white border border-black/5 flex items-center justify-center text-[11px]">🔔</span>
                <span className="w-7 h-7 rounded-full bg-white border border-black/5 flex items-center justify-center text-[11px]">💬</span>
              </div>
            </div>
            <div className="relative flex items-end justify-between mt-2 gap-2">
              {c.header.tagline && !hero && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[7.5px] font-extrabold uppercase tracking-wide max-w-[190px] truncate"
                  style={{ background: c.colors.accent, color: c.colors.accentText }}>
                  <span>{glyph(c.header.taglineIcon)}</span><span className="truncate">{c.header.tagline}</span>
                </span>
              )}
              {c.header.artUrl && <img src={c.header.artUrl} alt="" className="h-9 w-16 object-contain" />}
            </div>
            {!hero && (
              <div className="absolute left-0 right-0 bottom-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${c.colors.divider.join(', ')}, transparent)` }} />
            )}
          </div>

          {hero && (
            <div className="relative">
              {h.bunting && (
                <div className="relative h-3">
                  <div className="absolute inset-x-0 top-0 h-px bg-black/20" />
                  <div className="flex justify-around">
                    {Array.from({ length: 16 }, (_, i) => (
                      <span key={i} className="block w-0 h-0" style={{
                        borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
                        borderTop: `9px solid ${flags[i % flags.length]}`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              {h.mastheadUrl ? (
                <img src={h.mastheadUrl} alt="" className="w-full max-h-[110px] object-contain mt-1" />
              ) : (h.title || h.kicker) ? (
                <div className="flex items-center justify-center gap-2 px-4 pt-1 pb-2">
                  {h.emoji && <span className="text-2xl">{h.emoji}</span>}
                  <div className="text-center min-w-0" style={{ color: h.textColor }}>
                    {h.kicker && <p className="text-[8px] font-extrabold tracking-[0.3em]">✦ {h.kicker} ✦</p>}
                    {h.title && <p className="text-[22px] leading-tight italic font-bold truncate" style={{ fontFamily: 'Georgia, serif', textShadow: '0 2px 4px rgba(0,0,0,.18)' }}>{h.title}</p>}
                  </div>
                  {h.emoji && <span className="text-2xl">{h.emoji}</span>}
                </div>
              ) : null}
            </div>
          )}

          <div className="relative z-10 px-3 pt-2">
            <div className="h-24 rounded-2xl bg-white border-2 shadow-md flex items-center justify-center text-[10px] text-gray-400" style={{ borderColor: '#F5A623' }}>Carousel slides</div>
            <div className="flex justify-center gap-1 mt-2">
              <span className="h-1 w-4 rounded-full" style={{ background: c.colors.accent }} />
              <span className="h-1 w-1 rounded-full bg-black/20" /><span className="h-1 w-1 rounded-full bg-black/20" />
            </div>
          </div>
        </div>

        {/* ── Festive tiles ── */}
        {hero && h.showTiles && h.tiles.length > 0 && (
          <div className="relative z-10 mt-3">
            {h.tilesTitle && (
              <div className="flex items-center gap-1.5 px-4 mb-2" style={{ color: c.colors.accent }}>
                <span className="flex-1 h-px opacity-50" style={{ background: c.colors.accent }} />
                <span className="text-[8px]">◆</span>
                <span className="text-[13px] font-extrabold whitespace-nowrap" style={{ fontFamily: 'Georgia, serif' }}>{h.tilesTitle}</span>
                <span className="text-[8px]">◆</span>
                <span className="flex-1 h-px opacity-50" style={{ background: c.colors.accent }} />
              </div>
            )}
            <div className="mm-noscroll flex gap-2 px-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {h.tiles.map((t, i) => (
                <div key={i} className="w-[76px] h-[90px] shrink-0 rounded-xl overflow-hidden flex flex-col items-center pt-1.5 shadow-sm border border-black/5"
                  style={{ background: t.color }}>
                  <p className={`text-[8.5px] font-extrabold text-center leading-tight px-1 line-clamp-2 ${isLightHex(t.color) ? 'text-gray-900' : 'text-white'}`}>{t.label}</p>
                  <div className="relative flex-1 w-full flex items-center justify-center">
                    {t.imageUrl ? <img src={t.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      : <span className="text-[28px]">{t.emoji || '✨'}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Rows ── */}
        <div className="relative z-10 px-3 pt-3 pb-4 space-y-3">
          {c.sections.filter((s) => s.visible).map((s) => (
            <div key={s.key}>
              <p className="text-[10px] font-extrabold text-gray-800 mb-1">{s.key === 'rows' ? 'Most Watched This Week' : (s.title || SECTION_LABELS[s.key])}</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => <div key={i} className="w-[78px] h-[104px] rounded-lg bg-white/80 border border-black/5" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function isLightHex(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.62;
}
