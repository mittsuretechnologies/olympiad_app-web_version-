'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2, Plus, X, Trash2, AlertCircle, GripVertical, Pencil, Info, Lock, Search, Home,
  UploadCloud, ChevronUp, ChevronDown, Eye, EyeOff, LayoutGrid, Flame, Shuffle, ListOrdered,
} from 'lucide-react';
import {
  AUDIENCE_LABELS, NORMAL_AUDIENCES, browseGroups, categoryNames, isNationalCategory, isNormalCategory, isSlot, isStateCategory,
  type Audience, type BrowseGroup, type CategoryDTO,
} from '@/lib/uploadCategoryShared';
import { IONICON_NAMES, IONICON_VERSION } from '@/lib/ioniconNames';
import type { HomeLayoutEntry } from '@/lib/homeLayout';
import {
  DEFAULT_TRENDING_SETTINGS, MIN_VIDEOS_LIMITS, eligibleOptions, isOptionOn, istDayLabel, listsOption, orderedOptions,
  pickForDay, type TrendingMode, type TrendingOption, type TrendingSettings, type TrendingView,
} from '@/lib/trendingTotsShared';

// SuperAdmin → Upload Categories. The categories the app offers on its upload
// screen, per kind of user, and the category lists on the app's Search and
// Home screens. Read side: src/lib/uploadCategories.ts; rules on saving:
// src/lib/uploadCategoriesAdmin.ts.

type Tab = Audience | 'STATE' | 'NATIONAL' | 'SEARCH' | 'HOME';
const TABS: { key: Tab; label: string }[] = [
  { key: 'NORMAL', label: 'General User' },
  { key: 'OLYMPIAD_STUDENT', label: 'Olympiad Student' },
  { key: 'STATE', label: 'State Level' },
  { key: 'NATIONAL', label: 'National Level' },
  { key: 'GENERAL_SCHOOL', label: 'General School' },
  { key: 'OLYMPIAD_SCHOOL', label: 'Olympiad School' },
  { key: 'SEARCH', label: 'Search Screen' },
  { key: 'HOME', label: 'Home Screen' },
];

const CLASS_NAMES: Record<string, string> = { P: 'PG', N: 'Nursery', L: 'LKG', U: 'UKG' };
// Home has its own Learning / Parenting rows (dashboard → Learning & Parenting);
// the app leaves these two categories' rows out.
const HOME_CURATED = new Set(['learning', 'parenting']);

interface DraftSub {
  rowKey: string;
  id?: string;
  label: string;
  aliases: string[];
  icon: string;
  classCodes: string[];
  isActive: boolean;
}
interface Draft {
  id?: string;
  key?: string;
  slotKind: string;
  label: string;
  aliases: string[];
  icon: string;
  color: string;
  imageUrl: string;
  audiences: string[];
  isActive: boolean;
  showInSearch: boolean;
  searchLabel: string;
  searchCats: string[];
  showOnHome: boolean;
  subs: DraftSub[];
}

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// Same generic image upload the App Carousel uses.
async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/dashboard/banners/upload', { method: 'POST', headers: authHeaders(), body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Upload failed');
  return data.imageUrl as string;
}

let rowSeq = 0;
const newRowKey = () => `r${++rowSeq}`;

function toDraft(c: CategoryDTO): Draft {
  return {
    id: c.id, key: c.key, slotKind: c.slotKind, label: c.label, aliases: c.aliases,
    icon: c.icon, color: c.color, imageUrl: c.imageUrl ?? '', audiences: c.audiences, isActive: c.isActive,
    showInSearch: c.showInSearch, searchLabel: c.searchLabel ?? '',
    searchCats: c.searchCats.filter((n) => n.toLowerCase() !== c.label.toLowerCase()),
    showOnHome: c.showOnHome,
    subs: c.subs.map((s) => ({
      rowKey: newRowKey(), id: s.id, label: s.label, aliases: s.aliases, icon: s.icon,
      classCodes: s.classCodes, isActive: s.isActive,
    })),
  };
}

function blankDraft(audience: Audience | null): Draft {
  return {
    slotKind: 'NONE', label: '', aliases: [], icon: 'apps-outline', color: '#5C6B8A', imageUrl: '',
    audiences: audience && audience !== 'OLYMPIAD_STUDENT' ? [audience] : [], isActive: true,
    showInSearch: true, searchLabel: '', searchCats: [], showOnHome: false,
    subs: [{ rowKey: newRowKey(), label: '', aliases: [], icon: 'star-outline', classCodes: [], isActive: true }],
  };
}

// ── Small pieces ────────────────────────────────────────────────────────────

/** An Ionicons icon exactly as the app draws it (same icon set version). */
function Ion({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [name]);
  if (bad || !name) return <span className={`${className} inline-block rounded bg-gray-200`} title={`Unknown icon "${name}"`} />;
  return (
    <img
      src={`https://cdn.jsdelivr.net/npm/ionicons@${IONICON_VERSION}/dist/svg/${name}.svg`}
      alt="" className={className} onError={() => setBad(true)}
    />
  );
}

function Toggle({ on, onChange, disabled, title }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button" title={title} disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-[#009846]' : 'bg-gray-300'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function IconPicker({ value, onChange, small }: { value: string; onChange: (v: string) => void; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const known = IONICON_NAMES.includes(value);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return IONICON_NAMES.filter((n) => (t ? n.includes(t) : n.endsWith('-outline'))).slice(0, 160);
  }, [q]);
  return (
    <div className="relative" ref={box}>
      <button
        type="button" onClick={() => setOpen(!open)} title={known ? value : `"${value}" is not an icon the app has — pick another`}
        className={`flex items-center gap-1.5 border rounded-lg bg-white hover:border-[#004f9f] ${small ? 'h-8 px-2' : 'h-10 px-3'} ${known ? 'border-gray-200' : 'border-red-300 bg-red-50'}`}
      >
        <Ion name={value} className={small ? 'w-4 h-4' : 'w-5 h-5'} />
        {!small && <span className="text-xs text-gray-600 font-mono">{value}</span>}
        <ChevronDown size={12} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-2">
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search icons (e.g. music, star)"
            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs mb-2 focus:outline-none focus:border-[#004f9f]"
          />
          <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto">
            {list.map((n) => (
              <button
                key={n} type="button" title={n}
                onClick={() => { onChange(n); setOpen(false); }}
                className={`h-8 flex items-center justify-center rounded-md hover:bg-blue-50 ${n === value ? 'bg-blue-100 ring-1 ring-[#004f9f]' : ''}`}
              >
                <Ion name={n} className="w-4 h-4" />
              </button>
            ))}
          </div>
          {list.length === 0 && <p className="text-[11px] text-gray-400 text-center py-3">No icon matches</p>}
        </div>
      )}
    </div>
  );
}

/** Rows that can be dragged into a new order. */
function useDragOrder<T extends { id: string }>(items: T[], onDrop: (ids: string[]) => void) {
  const [order, setOrder] = useState<T[]>(items);
  const from = useRef<number | null>(null);
  const moved = useRef(false);
  const current = useRef(order);
  current.current = order;
  useEffect(() => setOrder(items), [items]);
  return {
    order,
    rowProps: (i: number) => ({
      draggable: true,
      onDragStart: () => { from.current = i; },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        if (from.current === null || from.current === i) return;
        const next = [...current.current];
        const [item] = next.splice(from.current, 1);
        next.splice(i, 0, item);
        from.current = i;
        moved.current = true;
        current.current = next;
        setOrder(next);
      },
      onDragEnd: () => {
        from.current = null;
        if (moved.current) onDrop(current.current.map((x) => x.id));
        moved.current = false;
      },
    }),
  };
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function UploadCategoriesPage() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [videoCounts, setVideoCounts] = useState<Record<string, number>>({});
  const [browseCounts, setBrowseCounts] = useState<Record<string, number>>({});
  const [homeLayout, setHomeLayout] = useState<HomeLayoutEntry[]>([]);
  const [trending, setTrending] = useState<TrendingView | null>(null);
  const [classLetters, setClassLetters] = useState<string[]>(['P', 'N', 'L', 'U']);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('NORMAL');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState('');

  const load = async () => {
    setLoadError('');
    try {
      const data = await api('/api/dashboard/upload-categories', 'GET');
      setCategories(data.categories ?? []);
      setVideoCounts(data.videoCounts ?? {});
      setBrowseCounts(data.browseCounts ?? {});
      setHomeLayout(data.homeLayout ?? []);
      setTrending(data.trending ?? null);
      if (Array.isArray(data.classLetters)) setClassLetters(data.classLetters);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const countFor = (names: string[]) => {
    const want = new Set(names.map((n) => n.toLowerCase()));
    return Object.entries(videoCounts).reduce((sum, [n, c]) => sum + (want.has(n.toLowerCase()) ? c : 0), 0);
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try { await fn(); await load(); } catch (e: any) { alert(e.message); await load(); } finally { setBusy(''); }
  };

  const setFlag = (c: CategoryDTO, flag: 'isActive' | 'showInSearch' | 'showOnHome', value: boolean) => {
    setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, [flag]: value } : x)));
    run('Saving…', () => api(`/api/dashboard/upload-categories/${c.id}`, 'PATCH', { [flag]: value }));
  };

  const saveOrder = (list: 'upload' | 'search', ids: string[]) => {
    const field = list === 'upload' ? 'sortOrder' : 'searchSortOrder';
    const pos = new Map(ids.map((id, i) => [id, i]));
    setCategories((prev) => prev.map((c) => (pos.has(c.id) ? { ...c, [field]: pos.get(c.id)! } : c)));
    run('Saving order…', () => api('/api/dashboard/upload-categories', 'PATCH', { list, order: ids }));
  };

  const remove = (c: CategoryDTO) => {
    const n = countFor(categoryNames(c));
    if (!confirm(
      `Delete "${c.label}"?\n\n${n} video${n === 1 ? '' : 's'} carry this name. They are not deleted and keep their category name, `
      + 'but no list will offer it any more. Closing the category for uploads (the switch) is usually the better choice.',
    )) return;
    run('Deleting…', () => api(`/api/dashboard/upload-categories/${c.id}`, 'DELETE'));
  };

  const byUpload = useMemo(() => [...categories].sort((a, b) => a.sortOrder - b.sortOrder), [categories]);
  const bySearch = useMemo(() => [...categories].sort((a, b) => a.searchSortOrder - b.searchSortOrder), [categories]);
  const groups = useMemo(() => browseGroups(categories), [categories]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Upload Categories</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            What each kind of user can upload into, and the category lists on the app&apos;s Search and Home screens.
            Changes reach the app within a minute.
          </p>
        </div>
        {tab !== 'OLYMPIAD_STUDENT' && tab !== 'STATE' && tab !== 'NATIONAL' && (
          <button
            onClick={() => setDraft(blankDraft(tab === 'SEARCH' || tab === 'HOME' ? null : tab))}
            className="inline-flex items-center gap-2 bg-[#004f9f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#003d7a] transition-colors"
          >
            <Plus size={15} /> Add Category
          </button>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key} onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${tab === t.key ? 'bg-[#004f9f] text-white border-[#004f9f]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#004f9f]/40'}`}
          >
            {t.key === 'SEARCH' && <Search size={11} className="inline mr-1 -mt-0.5" />}
            {t.key === 'HOME' && <Home size={11} className="inline mr-1 -mt-0.5" />}
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : loadError ? (
        <div className="py-16 flex flex-col items-center gap-2 text-red-500 text-sm"><AlertCircle size={18} /> {loadError}</div>
      ) : tab === 'SEARCH' ? (
        <SearchList items={bySearch.filter(isNormalCategory)} slots={byUpload.filter(isSlot)} groups={groups}
          counts={browseCounts} onToggle={(c, v) => setFlag(c, 'showInSearch', v)}
          onEdit={(c) => setDraft(toDraft(c))} onOrder={(ids) => saveOrder('search', ids)} />
      ) : tab === 'HOME' ? (
        <>
        <HomeList layout={homeLayout} categories={categories} slots={byUpload.filter(isSlot)} groups={groups}
          counts={browseCounts} onToggleCategory={(c, v) => {
            setHomeLayout((prev) => prev.map((e) => (e.key === `cat:${c.key}` ? { ...e, visible: v } : e)));
            setFlag(c, 'showOnHome', v);
          }}
          onToggleSection={(key, v) => {
            setHomeLayout((prev) => prev.map((e) => (e.key === key ? { ...e, visible: v } : e)));
            run('Saving…', () => api('/api/dashboard/upload-categories', 'PATCH', { section: key, visible: v }));
          }}
          onEdit={(c) => setDraft(toDraft(c))}
          onOrder={(keys) => {
            setHomeLayout((prev) => keys.map((k) => prev.find((e) => e.key === k)!).filter(Boolean));
            run('Saving order…', () => api('/api/dashboard/upload-categories', 'PATCH', { list: 'home', order: keys }));
          }} />
        <TrendingTotsBox view={trending}
          onSave={(s) => run('Saving Trending Tots…', () => api('/api/dashboard/upload-categories', 'PATCH', { trending: s }))} />
        </>
      ) : tab === 'OLYMPIAD_STUDENT' ? (
        <SlotList items={byUpload.filter(isSlot)} countFor={countFor} onEdit={(c) => setDraft(toDraft(c))} />
      ) : tab === 'STATE' || tab === 'NATIONAL' ? (
        <StateList level={tab} items={byUpload.filter(tab === 'STATE' ? isStateCategory : isNationalCategory)} countFor={countFor}
          onEdit={(c) => setDraft(toDraft(c))} onToggleOpen={(c, v) => setFlag(c, 'isActive', v)} />
      ) : (
        <AudienceList
          audience={tab}
          items={byUpload.filter((c) => isNormalCategory(c) && c.audiences.includes(tab))}
          countFor={countFor}
          onEdit={(c) => setDraft(toDraft(c))}
          onToggleOpen={(c, v) => setFlag(c, 'isActive', v)}
          onDelete={remove}
          onOrder={(ids) => {
            // Upload order is one list across all users: this tab's categories
            // take their new order in the places they already hold.
            const tabIds = new Set(ids);
            const queue = [...ids];
            saveOrder('upload', byUpload.map((c) => (tabIds.has(c.id) ? queue.shift()! : c.id)));
          }}
        />
      )}

      {busy && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> {busy}</p>}

      {draft && (
        <Editor
          draft={draft} setDraft={setDraft} classLetters={classLetters}
          knownNames={Object.keys(videoCounts)}
          onClose={() => setDraft(null)}
          onSaved={async () => { setDraft(null); await load(); }}
        />
      )}
    </div>
  );
}

// ── Lists ───────────────────────────────────────────────────────────────────

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs bg-blue-50 border-blue-100 text-blue-800">
      <Info size={14} className="mt-0.5 shrink-0" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CategoryTile({ c }: { c: CategoryDTO }) {
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.color}22`, border: `1px solid ${c.color}55` }}>
      <Ion name={c.icon} className="w-5 h-5" />
    </div>
  );
}

const videos = (n: number) => `${n} video${n === 1 ? '' : 's'}`;

const subSummary = (c: CategoryDTO) => {
  const hidden = c.subs.filter((s) => !s.isActive).length;
  return `${c.subs.length} option${c.subs.length === 1 ? '' : 's'}${hidden ? ` · ${hidden} switched off` : ''}`;
};

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'gray' | 'red' | 'blue' | 'amber' }) {
  const cls = {
    green: 'bg-green-50 text-green-700 border-green-200', gray: 'bg-gray-50 text-gray-500 border-gray-200',
    red: 'bg-red-50 text-red-600 border-red-200', blue: 'bg-blue-50 text-[#004f9f] border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  }[tone];
  return <span className={`px-1.5 py-0.5 text-[10px] font-semibold border rounded ${cls}`}>{children}</span>;
}

function Panel({ children, empty }: { children: React.ReactNode; empty?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {empty ? <div className="py-16 text-center text-gray-400 text-sm">{empty}</div> : <div className="divide-y divide-gray-50">{children}</div>}
    </div>
  );
}

function IconBtn({ onClick, title, children, tone = 'blue' }: { onClick: () => void; title: string; children: React.ReactNode; tone?: 'blue' | 'red' }) {
  return (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded-lg transition-colors ${tone === 'red' ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-[#004f9f]/5 text-[#004f9f] hover:bg-[#004f9f]/10'}`}>
      {children}
    </button>
  );
}

function AudienceList({ audience, items, countFor, onEdit, onToggleOpen, onDelete, onOrder }: {
  audience: Audience; items: CategoryDTO[]; countFor: (n: string[]) => number;
  onEdit: (c: CategoryDTO) => void; onToggleOpen: (c: CategoryDTO, v: boolean) => void;
  onDelete: (c: CategoryDTO) => void; onOrder: (ids: string[]) => void;
}) {
  const { order, rowProps } = useDragOrder(items, onOrder);
  return (
    <>
      <Note>
        {audience === 'NORMAL' && <p>General users upload from this list. Olympiad students use it too, once both their Olympiad videos are submitted.</p>}
        {audience === 'GENERAL_SCHOOL' && <p>Schools that signed up in the app upload their own videos from this list.</p>}
        {audience === 'OLYMPIAD_SCHOOL' && (
          <p>An Olympiad school&apos;s own videos — the same list in the app and on the school portal. When the school uploads
            <strong> for a student</strong>, the Olympiad Student categories are used instead.</p>
        )}
        <p>Drag rows to change the order on the upload screen. The switch opens or closes a category for uploads; a closed one can still show on Search and Home.</p>
      </Note>
      <Panel empty={order.length ? undefined : 'No categories for these users yet. Add one to get started.'}>
        {order.map((c, i) => {
          const others = c.audiences.filter((a) => a !== audience).map((a) => AUDIENCE_LABELS[a as Audience] ?? a);
          return (
            <div key={c.id} {...rowProps(i)} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 cursor-grab active:cursor-grabbing">
              <GripVertical size={16} className="text-gray-300 shrink-0" />
              <CategoryTile c={c} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{c.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-gray-400">{subSummary(c)} · {videos(countFor(categoryNames(c)))}</span>
                  {!c.isActive && <Badge tone="red">Closed for uploads</Badge>}
                  {c.showInSearch && <Badge tone="blue">Search</Badge>}
                  {c.showOnHome && <Badge tone="green">Home</Badge>}
                  {others.length > 0 && <Badge tone="gray">Also: {others.join(', ')}</Badge>}
                </div>
              </div>
              <Toggle on={c.isActive} onChange={(v) => onToggleOpen(c, v)} title={c.isActive ? 'Open for uploads' : 'Closed for uploads'} />
              <IconBtn onClick={() => onEdit(c)} title="Edit"><Pencil size={13} /></IconBtn>
              <IconBtn onClick={() => onDelete(c)} title="Delete" tone="red"><Trash2 size={13} /></IconBtn>
            </div>
          );
        })}
      </Panel>
    </>
  );
}

function SlotList({ items, countFor, onEdit }: { items: CategoryDTO[]; countFor: (n: string[]) => number; onEdit: (c: CategoryDTO) => void }) {
  return (
    <>
      <Note>
        <p>The two Olympiad categories — one video each per student. Students upload into them from the app, and Olympiad schools upload into them for their students (app and school portal).</p>
        <p>Their names are fixed: slots, marks and results recognise a video by its category name. Inside them you can add, rename, switch off and reorder options, and choose which classes see each option.</p>
      </Note>
      <Panel empty={items.length ? undefined : 'Olympiad categories not found.'}>
        {items.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <CategoryTile c={c} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                {c.label} <Lock size={12} className="text-gray-400" />
                <Badge tone="amber">Slot {c.slotKind === 'OLY_A' ? 'A' : 'B'}</Badge>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{subSummary(c)} · {videos(countFor(categoryNames(c)))} named &quot;{c.label}&quot;</p>
            </div>
            <IconBtn onClick={() => onEdit(c)} title="Edit options"><Pencil size={13} /></IconBtn>
          </div>
        ))}
      </Panel>
    </>
  );
}

function StateList({ level, items, countFor, onEdit, onToggleOpen }: {
  level: 'STATE' | 'NATIONAL';
  items: CategoryDTO[]; countFor: (n: string[]) => number;
  onEdit: (c: CategoryDTO) => void; onToggleOpen: (c: CategoryDTO, v: boolean) => void;
}) {
  const name = level === 'NATIONAL' ? 'National Level' : 'State Level';
  return (
    <>
      <Note>
        {level === 'NATIONAL' ? (
          <>
            <p>The National Level competition category. Only students forwarded from Result → National Level (each state&apos;s Rank 1) see it in the app, and each can upload <strong>one</strong> theme video into it. Put the theme in the option name.</p>
            <p>Its videos are moderated and evaluated like State Level videos and are one quarter of the National %. It starts closed: open it when the theme is announced.</p>
          </>
        ) : (
          <>
            <p>The State Level competition category. Only students forwarded from Result → State Level see it in the app, and each can upload <strong>one</strong> video into it.</p>
            <p>Its videos are moderated and evaluated like Olympiad videos and make up the State Level result; they never count in the Olympiad result. Close it to stop new State Level uploads.</p>
          </>
        )}
      </Note>
      <Panel empty={items.length ? undefined : `${name} category not found. It is added automatically the next time this page loads.`}>
        {items.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <CategoryTile c={c} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                {c.label} <Badge tone="amber">{name}</Badge>
                {c.isActive ? <Badge tone="green">Open</Badge> : <Badge tone="gray">Closed</Badge>}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{subSummary(c)} · {videos(countFor(categoryNames(c)))} named &quot;{c.label}&quot;</p>
            </div>
            <Toggle on={c.isActive} onChange={(v) => onToggleOpen(c, v)} title={c.isActive ? 'Close for uploads' : 'Open for uploads'} />
            <IconBtn onClick={() => onEdit(c)} title="Edit"><Pencil size={13} /></IconBtn>
          </div>
        ))}
      </Panel>
    </>
  );
}

/** "Rhymes · Rhymes / Speech (its own options only)" — what a card / row shows. */
function showsText(g: BrowseGroup | undefined): string {
  if (!g) return '';
  return [
    ...g.ownNames,
    ...g.extras.map((x) => (x.excludeSubs.length ? `${x.name} (only videos with this category's options)` : x.name)),
  ].join(' · ');
}

/** Where the Olympiad categories' videos show, since they have no card / row of their own. */
function OlympiadPlacement({ slots, groups, surface }: {
  slots: CategoryDTO[]; groups: BrowseGroup[]; surface: 'search' | 'home';
}) {
  const on = (g: BrowseGroup) => (surface === 'search' ? g.category.showInSearch : g.category.showOnHome && !HOME_CURATED.has(g.category.key));
  return (
    <>
      {slots.map((s) => {
        const names = new Set(categoryNames(s).map((n) => n.toLowerCase()));
        const homes = groups.filter((g) => on(g) && [...g.ownNames, ...g.extras.map((x) => x.name)].some((n) => names.has(n.toLowerCase())));
        const split = homes.length > 1 || homes.some((g) => g.extras.some((x) => names.has(x.name.toLowerCase()) && x.excludeSubs.length));
        return (
          <p key={s.id}>
            Olympiad <strong>&quot;{s.label}&quot;</strong> videos show in{' '}
            {homes.length
              ? <>{homes.map((g) => `"${g.category.searchLabel && surface === 'search' ? g.category.searchLabel : g.category.label}"`).join(' and ')}{split ? ', each video in the one whose options include its option' : ''}.</>
              : <span className="text-red-700">no {surface === 'search' ? 'card' : 'row'} — switch on a category that lists &quot;{s.label}&quot; (edit it → &quot;Also show videos saved under&quot;).</span>}
          </p>
        );
      })}
    </>
  );
}

function SearchList({ items, slots, groups, counts, onToggle, onEdit, onOrder }: {
  items: CategoryDTO[]; slots: CategoryDTO[]; groups: BrowseGroup[]; counts: Record<string, number>;
  onToggle: (c: CategoryDTO, v: boolean) => void; onEdit: (c: CategoryDTO) => void; onOrder: (ids: string[]) => void;
}) {
  const { order, rowProps } = useDragOrder(items, onOrder);
  const byId = new Map(groups.map((g) => [g.category.id, g]));
  return (
    <>
      <Note>
        <p>The category cards on the app&apos;s Search screen (and the category filter on the Reels screen), in this order. Switch a category on to give it a card; drag to reorder. A card&apos;s options become the chips under it; Learning and Parenting cards also show the videos from Learning &amp; Parenting first.</p>
        <OlympiadPlacement slots={slots} groups={groups} surface="search" />
      </Note>
      <Panel>
        {order.map((c, i) => (
          <div key={c.id} {...rowProps(i)} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 cursor-grab active:cursor-grabbing ${c.showInSearch ? '' : 'opacity-60'}`}>
            <GripVertical size={16} className="text-gray-300 shrink-0" />
            <Toggle on={c.showInSearch} onChange={(v) => onToggle(c, v)} title={c.showInSearch ? 'Shown on Search' : 'Not on Search'} />
            <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: c.color }}>
              {c.imageUrl ? <img src={c.imageUrl} alt="" className="w-full h-full object-cover" /> : <Ion name={c.icon} className="w-5 h-5 invert" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{c.searchLabel || c.label}</p>
              <p className="text-[11px] text-gray-400 truncate">
                {videos(counts[c.id] ?? 0)} approved · saved under: {showsText(byId.get(c.id))}
              </p>
            </div>
            <IconBtn onClick={() => onEdit(c)} title="Edit"><Pencil size={13} /></IconBtn>
          </div>
        ))}
      </Panel>
    </>
  );
}

function HomeList({ layout, categories, slots, groups, counts, onToggleCategory, onToggleSection, onEdit, onOrder }: {
  layout: HomeLayoutEntry[]; categories: CategoryDTO[]; slots: CategoryDTO[]; groups: BrowseGroup[]; counts: Record<string, number>;
  onToggleCategory: (c: CategoryDTO, v: boolean) => void; onToggleSection: (key: string, v: boolean) => void;
  onEdit: (c: CategoryDTO) => void; onOrder: (keys: string[]) => void;
}) {
  const items = useMemo(() => layout.map((e) => ({ ...e, id: e.key })), [layout]);
  const { order, rowProps } = useDragOrder(items, onOrder);
  const byId = new Map(groups.map((g) => [`cat:${g.category.key}`, g]));
  const catOf = (key: string) => categories.find((c) => `cat:${c.key}` === key);
  const SECTION_NOTES: Record<string, string> = {
    mittfest: 'The MittFest row (videos marked for MittFest).',
    trending: 'Trending Tots: a different option every day (set it up in the box below). The top carousel keeps the overall most watched.',
    school: 'The row of the viewer’s own school videos (only shown to users who belong to a school).',
  };
  return (
    <>
      <Note>
        <p>Everything on the app&apos;s Home screen below the top carousel, in this order. Drag to reorder; the switch shows or hides an item. A row is hidden anyway while it has no videos.</p>
        <p>Learning and Parenting show the videos curated under Learning &amp; Parenting. Other category rows show the same videos as the category&apos;s Search card (most watched first).</p>
        <OlympiadPlacement slots={slots} groups={groups} surface="home" />
      </Note>
      <Panel>
        {order.map((e, i) => {
          const c = e.kind === 'category' ? catOf(e.key) : undefined;
          return (
            <div key={e.key} {...rowProps(i)} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 cursor-grab active:cursor-grabbing ${e.visible ? '' : 'opacity-60'}`}>
              <GripVertical size={16} className="text-gray-300 shrink-0" />
              <Toggle on={e.visible} title={e.visible ? 'Shown on Home' : 'Not on Home'}
                onChange={(v) => (c ? onToggleCategory(c, v) : onToggleSection(e.key, v))} />
              {c ? <CategoryTile c={c} /> : (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gray-100 border border-gray-200"><Home size={16} className="text-gray-500" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {e.label}
                  {!c && <span className="ml-1.5"><Badge tone="gray">Section</Badge></span>}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {c
                    ? (e.curated
                      ? `Videos curated under Learning & Parenting (${c.label}).`
                      : `${videos(counts[c.id] ?? 0)} approved · saved under: ${showsText(byId.get(e.key))}`)
                    : SECTION_NOTES[e.key]}
                </p>
              </div>
              {c && <IconBtn onClick={() => onEdit(c)} title="Edit"><Pencil size={13} /></IconBtn>}
            </div>
          );
        })}
      </Panel>
    </>
  );
}

/**
 * Trending Tots: which options take turns on the Home row, how (shuffle / the
 * SuperAdmin's order), and how many videos an option needs. The 7-day preview
 * uses the same rotation as the server (lib/trendingTotsShared), so it shows
 * the unsaved changes too.
 */
function TrendingTotsBox({ view, onSave }: { view: TrendingView | null; onSave: (s: TrendingSettings) => void }) {
  const [mode, setMode] = useState<TrendingMode>(DEFAULT_TRENDING_SETTINGS.mode);
  const [minVideos, setMinVideos] = useState<number>(DEFAULT_TRENDING_SETTINGS.minVideos);
  const [keys, setKeys] = useState<string[]>([]);         // option keys, in the SuperAdmin's order
  const [off, setOff] = useState<Set<string>>(new Set()); // option keys left out
  const [dirty, setDirty] = useState(false);

  const reset = useCallback(() => {
    if (!view) return;
    setMode(view.settings.mode);
    setMinVideos(view.settings.minVideos);
    setKeys(orderedOptions(view.options, view.settings).map((o) => o.key));
    setOff(new Set(view.options.filter((o) => !isOptionOn(o, view.settings)).map((o) => o.key)));
    setDirty(false);
  }, [view]);
  useEffect(() => { reset(); }, [reset]);

  const byKey = useMemo(() => new Map((view?.options ?? []).map((o) => [o.key, o])), [view]);
  const listed = useMemo(
    () => keys.map((k) => byKey.get(k)).filter((o): o is TrendingOption => !!o).map((o) => ({ ...o, id: o.key })),
    [keys, byKey],
  );
  const { order, rowProps } = useDragOrder(listed, (ids) => { setKeys(ids); setDirty(true); });

  if (!view) return null;

  // Saved names of options that aren't listed right now (e.g. switched off for
  // uploads) are kept, so they come back the way they were.
  const known = (n: string) => view.options.some((o) => listsOption([n], o));
  const draft: TrendingSettings = {
    mode,
    minVideos,
    order: [...listed.map((o) => o.name), ...view.settings.order.filter((n) => !known(n))],
    off: [...listed.filter((o) => off.has(o.key)).map((o) => o.name), ...view.settings.off.filter((n) => !known(n))],
  };
  const schedule = Array.from({ length: 7 }, (_, i) => {
    const day = view.day + i;
    // Today is fixed on the server; saving picks it again under the new settings.
    const option = i === 0 && !dirty
      ? (view.todayKey ? byKey.get(view.todayKey) ?? null : null)
      : pickForDay(listed, draft, day);
    return { day, option };
  });
  const readyCount = eligibleOptions(listed, draft).length;

  const toggle = (key: string, on: boolean) => {
    setOff((prev) => {
      const next = new Set(prev);
      if (on) next.delete(key); else next.add(key);
      return next;
    });
    setDirty(true);
  };
  const setMin = (raw: string) => {
    const v = Math.round(Number(raw));
    if (!Number.isFinite(v)) return;
    setMinVideos(Math.min(MIN_VIDEOS_LIMITS.max, Math.max(MIN_VIDEOS_LIMITS.min, v)));
    setDirty(true);
  };
  const MODES = [['shuffle', 'Shuffle daily', Shuffle], ['order', 'In my order', ListOrdered]] as const;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3 flex-wrap border-b border-gray-50">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 border border-amber-200">
          <Flame size={16} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm font-bold text-gray-800">Trending Tots</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            One option a day, changing at midnight India time. The row shows that option&apos;s most watched videos: views in the last 7 days first, then all-time.
            Options with the same name count as one, Olympiad videos included. If no option is ready, the row shows the overall most watched.
          </p>
        </div>
        {dirty && (
          <div className="flex items-center gap-2">
            <button onClick={reset} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">
              Discard
            </button>
            <button onClick={() => onSave(draft)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#004f9f] text-white hover:bg-[#003d7a]">
              Save
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-amber-50/40 border-b border-gray-50">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {schedule.map((d, i) => (
            <div key={d.day} className={`shrink-0 min-w-[110px] rounded-xl border px-3 py-2 ${i === 0 ? 'bg-amber-100 border-amber-300' : 'bg-white border-gray-200'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : istDayLabel(d.day)}
              </p>
              <p className={`text-xs font-semibold mt-0.5 ${d.option ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                {d.option?.name ?? 'Overall most watched'}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">
          {dirty ? 'Preview of your unsaved changes. Saving picks today’s option again.' : 'Today’s option stays for the whole day.'}{' '}
          Days ahead can shift when an option gains or loses videos.
        </p>
      </div>

      <div className="px-4 py-3 flex items-center gap-4 flex-wrap border-b border-gray-50">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {MODES.map(([m, label, Icon]) => (
            <button
              key={m} onClick={() => { setMode(m); setDirty(true); }}
              className={`px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 ${mode === m ? 'bg-[#004f9f] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <label className="text-xs text-gray-600 inline-flex items-center gap-2">
          Needs at least
          <input
            type="number" min={MIN_VIDEOS_LIMITS.min} max={MIN_VIDEOS_LIMITS.max} value={minVideos}
            onChange={(e) => setMin(e.target.value)}
            className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#004f9f]"
          />
          approved videos to get a day
        </label>
        <span className="text-[11px] text-gray-400 sm:ml-auto">{readyCount} of {listed.length} options ready</span>
      </div>

      {mode === 'order' && (
        <p className="px-4 pt-2 text-[11px] text-gray-400">Drag to set the order. The ready options take turns from the top.</p>
      )}
      <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
        {order.map((o, i) => {
          const on = !off.has(o.key);
          const ready = on && o.videos >= minVideos;
          const others = o.names.filter((n) => n.toLowerCase() !== o.key);
          return (
            <div
              key={o.key} {...(mode === 'order' ? rowProps(i) : {})}
              className={`flex items-center gap-3 px-4 py-2.5 ${mode === 'order' ? 'cursor-grab active:cursor-grabbing hover:bg-gray-50/60' : ''} ${on ? '' : 'opacity-60'}`}
            >
              {mode === 'order' && <GripVertical size={16} className="text-gray-300 shrink-0" />}
              <Toggle on={on} onChange={(v) => toggle(o.key, v)} title={on ? 'In the rotation' : 'Left out'} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{o.name}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  {o.categories.join(' · ')}{others.length ? ` · also counts: ${others.join(', ')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {schedule[0].option?.key === o.key && <Badge tone="green">Today</Badge>}
                {on && !ready && <Badge tone="amber">Needs {minVideos}+ videos</Badge>}
                <Badge tone="gray">{videos(o.videos)}</Badge>
              </div>
            </div>
          );
        })}
        {order.length === 0 && (
          <div className="py-10 text-center text-gray-400 text-sm">No options yet. Add options to your categories first.</div>
        )}
      </div>
    </div>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────

function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-xl p-3.5 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">{icon}{title}</p>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#004f9f]';

function Editor({ draft, setDraft, classLetters, knownNames, onClose, onSaved }: {
  draft: Draft; setDraft: (d: Draft) => void; classLetters: string[]; knownNames: string[];
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const slot = draft.slotKind === 'OLY_A' || draft.slotKind === 'OLY_B';
  // A competition category (State or National Level): no audiences, forwarding decides who uploads.
  const state = draft.slotKind === 'STATE' || draft.slotKind === 'NATIONAL';
  const levelName = draft.slotKind === 'NATIONAL' ? 'National Level' : 'State Level';
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [catInput, setCatInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setSub = (rowKey: string, patch: Partial<DraftSub>) =>
    set({ subs: draft.subs.map((s) => (s.rowKey === rowKey ? { ...s, ...patch } : s)) });
  const moveSub = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= draft.subs.length) return;
    const next = [...draft.subs];
    [next[i], next[j]] = [next[j], next[i]];
    set({ subs: next });
  };
  const addSub = () => set({
    subs: [...draft.subs, { rowKey: newRowKey(), label: '', aliases: [], icon: 'star-outline', classCodes: [], isActive: true }],
  });
  const addSearchCat = (name: string) => {
    const n = name.trim();
    if (!n || draft.searchCats.some((x) => x.toLowerCase() === n.toLowerCase()) || n.toLowerCase() === draft.label.trim().toLowerCase()) return;
    set({ searchCats: [...draft.searchCats, n] });
    setCatInput('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const body = {
        label: draft.label, icon: draft.icon, color: draft.color, imageUrl: draft.imageUrl || null,
        audiences: draft.audiences, isActive: draft.isActive,
        showInSearch: draft.showInSearch, searchLabel: draft.searchLabel || null, searchCats: draft.searchCats,
        showOnHome: draft.showOnHome,
        subs: draft.subs.map((s) => ({ id: s.id, label: s.label, icon: s.icon, classCodes: s.classCodes, isActive: s.isActive })),
      };
      if (draft.id) await api(`/api/dashboard/upload-categories/${draft.id}`, 'PUT', body);
      else await api('/api/dashboard/upload-categories', 'POST', body);
      await onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const curatedHome = !!draft.key && HOME_CURATED.has(draft.key);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden">
        <div className="bg-[#004f9f] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              {draft.id ? (slot ? 'Olympiad category' : state ? `${levelName} category` : 'Edit category') : 'New category'}
            </p>
            <p className="text-white font-bold text-sm mt-0.5">{draft.label || 'Untitled'}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
          <Section title="Category" icon={<LayoutGrid size={11} />}>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Name (saved on every video uploaded into it)</label>
              <div className="relative">
                <input value={draft.label} onChange={(e) => set({ label: e.target.value })} disabled={slot} maxLength={60}
                  placeholder="e.g. Drawing & Painting" className={`${inputCls} ${slot ? 'bg-gray-50 text-gray-500 pr-8' : ''}`} />
                {slot && <Lock size={13} className="absolute right-3 top-3 text-gray-400" />}
              </div>
              {slot && <p className="text-[10px] text-gray-400 mt-1">Fixed: Olympiad slots, marks and results recognise videos by this name.</p>}
              {draft.aliases.length > 0 && <p className="text-[10px] text-gray-400 mt-1">Earlier names (old videos still show here): {draft.aliases.join(', ')}</p>}
            </div>
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Icon</label>
                <IconPicker value={draft.icon} onChange={(icon) => set({ icon })} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Colour</label>
                <div className="flex items-center gap-2 h-10">
                  <input type="color" value={draft.color} onChange={(e) => set({ color: e.target.value.toUpperCase() })}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white" />
                  <span className="text-xs text-gray-500 font-mono">{draft.color}</span>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Who can upload into it">
            {state ? (
              <>
                <p className="text-xs text-gray-600">Only students forwarded to the {levelName} (Result → {levelName}), one video each.</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <Toggle on={draft.isActive} onChange={(v) => set({ isActive: v })} />
                  {draft.isActive ? `Open for ${levelName} uploads` : 'Closed for uploads'}
                </label>
              </>
            ) : slot ? (
              <p className="text-xs text-gray-600">Olympiad students (their Olympiad video for slot {draft.slotKind === 'OLY_A' ? 'A' : 'B'}), and Olympiad schools uploading for a student. Always open.</p>
            ) : (
              <>
                <div className="flex gap-4 flex-wrap">
                  {NORMAL_AUDIENCES.map((a) => (
                    <label key={a} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={draft.audiences.includes(a)}
                        onChange={(e) => set({ audiences: e.target.checked ? [...draft.audiences, a] : draft.audiences.filter((x) => x !== a) })} />
                      {AUDIENCE_LABELS[a]}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400">General User includes Olympiad students once both their Olympiad videos are in. Leave all unticked for a category that only shows on Search / Home.</p>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <Toggle on={draft.isActive} onChange={(v) => set({ isActive: v })} />
                  {draft.isActive ? 'Open for uploads' : 'Closed for uploads (still shows on Search / Home if switched on there)'}
                </label>
              </>
            )}
          </Section>

          <Section title={`Options (${draft.subs.length})`}>
            <p className="text-[10px] text-gray-400 -mt-1">
              The choices under the category. Renaming keeps the old name for videos already uploaded under it.
              {slot ? ' Olympiad options can be switched off but not deleted.' : ''}
              {slot ? ' Classes: tick the classes that see an option (none ticked = every class).' : ''}
            </p>
            <div className="space-y-1.5">
              {draft.subs.map((s, i) => (
                <div key={s.rowKey} className={`flex items-center gap-1.5 ${s.isActive ? '' : 'opacity-60'}`}>
                  <div className="flex flex-col">
                    <button type="button" onClick={() => moveSub(i, -1)} className="text-gray-300 hover:text-gray-600" title="Move up"><ChevronUp size={13} /></button>
                    <button type="button" onClick={() => moveSub(i, 1)} className="text-gray-300 hover:text-gray-600" title="Move down"><ChevronDown size={13} /></button>
                  </div>
                  <IconPicker small value={s.icon} onChange={(icon) => setSub(s.rowKey, { icon })} />
                  <div className="flex-1 min-w-0">
                    <input value={s.label} onChange={(e) => setSub(s.rowKey, { label: e.target.value })} maxLength={60}
                      placeholder="Option name" className="w-full border border-gray-200 rounded-lg px-2.5 h-8 text-sm focus:outline-none focus:border-[#004f9f]" />
                    {s.aliases.length > 0 && <p className="text-[10px] text-gray-400 truncate">was: {s.aliases.join(', ')}</p>}
                  </div>
                  {slot && (
                    <div className="flex gap-0.5">
                      {classLetters.map((code) => {
                        const on = s.classCodes.includes(code);
                        return (
                          <button key={code} type="button" title={CLASS_NAMES[code] ?? code}
                            onClick={() => setSub(s.rowKey, { classCodes: on ? s.classCodes.filter((x) => x !== code) : [...s.classCodes, code] })}
                            className={`h-8 px-1.5 rounded-md text-[10px] font-bold border ${on ? 'bg-[#004f9f] text-white border-[#004f9f]' : 'bg-white text-gray-400 border-gray-200'}`}>
                            {CLASS_NAMES[code] ?? code}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button type="button" onClick={() => setSub(s.rowKey, { isActive: !s.isActive })}
                    title={s.isActive ? 'Switched on — click to hide it' : 'Switched off — click to show it'}
                    className={`p-1.5 rounded-lg ${s.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                    {s.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  {(!slot || !s.id) ? (
                    <button type="button" onClick={() => set({ subs: draft.subs.filter((x) => x.rowKey !== s.rowKey) })}
                      title="Remove" className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                  ) : <span className="w-[26px]" />}
                </div>
              ))}
            </div>
            <button type="button" onClick={addSub}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004f9f] hover:underline"><Plus size={13} /> Add option</button>
          </Section>

          {state ? (
            <Section title="Search and Home screens" icon={<Search size={11} />}>
              <p className="text-xs text-gray-600">No card on Search and no row on Home: it is a competition category.</p>
            </Section>
          ) : slot ? (
            <Section title="Search and Home screens" icon={<Search size={11} />}>
              <p className="text-xs text-gray-600">
                No card or row of its own: its videos show inside the normal categories that carry the name
                &quot;{draft.label}&quot; (see the Search Screen and Home Screen tabs).
              </p>
            </Section>
          ) : (<>
          <Section title="Search screen" icon={<Search size={11} />}>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Toggle on={draft.showInSearch} onChange={(v) => set({ showInSearch: v })} />
              {draft.showInSearch ? 'Has a card on Search' : 'No card on Search'}
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Card title (blank = the category name)</label>
                  <input value={draft.searchLabel} onChange={(e) => set({ searchLabel: e.target.value })} maxLength={60}
                    placeholder={draft.label} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Also show videos saved under (Search and Home)</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {draft.searchCats.map((n) => (
                      <span key={n} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#004f9f] text-xs">
                        {n}
                        <button type="button" onClick={() => set({ searchCats: draft.searchCats.filter((x) => x !== n) })}><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                  <input value={catInput} onChange={(e) => setCatInput(e.target.value)} list="known-category-names"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSearchCat(catInput); } }}
                    placeholder="Type or pick a category name, then Enter" className={inputCls} />
                  <datalist id="known-category-names">
                    {knownNames.map((n) => <option key={n} value={n} />)}
                  </datalist>
                  <p className="text-[10px] text-gray-400 mt-1">
                    E.g. Rhymes lists the Olympiad &quot;Rhymes / Speech&quot;. When several categories list the same name, each
                    video goes to the one whose options include its option (rhymes → Rhymes, speech topics → Speech).
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Card picture</label>
                <div onClick={() => fileRef.current?.click()}
                  className="relative w-40 aspect-[16/7] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-[#004f9f]/40 cursor-pointer overflow-hidden flex items-center justify-center">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin text-[#004f9f]" />
                    : draft.imageUrl ? <img src={draft.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="flex flex-col items-center gap-1 text-gray-400 text-[10px] text-center px-2"><UploadCloud size={16} />Upload (blank = the app&apos;s own picture or the colour)</span>}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      setUploading(true);
                      try { set({ imageUrl: await uploadImage(file) }); } catch (err: any) { setError(err.message); } finally { setUploading(false); }
                    }} />
                </div>
                {draft.imageUrl && <button type="button" onClick={() => set({ imageUrl: '' })} className="text-[11px] text-red-500 hover:underline mt-1">Remove picture</button>}
              </div>
            </div>
          </Section>

          <Section title="Home screen" icon={<Home size={11} />}>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Toggle on={draft.showOnHome} onChange={(v) => set({ showOnHome: v })} />
              {draft.showOnHome
                ? (curatedHome ? 'Shows its Learning & Parenting videos on Home' : 'Has a row on Home (order: Home Screen tab)')
                : 'No row on Home'}
            </label>
          </Section>
          </>)}

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving || uploading}
            className="flex-1 py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {draft.id ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  );
}
