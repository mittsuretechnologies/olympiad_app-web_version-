'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, Loader2, Power, Save, Search } from 'lucide-react';
import { MITTTV_AUDIENCES, MITTTV_LIMITS, type MittTvAudience, type MittTvSettings } from '@/lib/mittTvShared';
import { api } from '../_lib/api';
import { Label, Switch, inputCls } from './common';

export default function SettingsTab({ settings, onSaved }: { settings: MittTvSettings; onSaved: (s: MittTvSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setDraft(settings), [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const toggleAudience = (a: MittTvAudience) => setDraft((d) => ({
    ...d, audiences: d.audiences.includes(a) ? d.audiences.filter((x) => x !== a) : [...d.audiences, a],
  }));

  const save = async () => {
    setSaving(true); setError('');
    try { onSaved((await api<{ settings: MittTvSettings }>('/api/dashboard/mitttv', 'PATCH', draft)).settings); }
    catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className={`rounded-2xl border p-5 flex items-center gap-4 ${draft.enabled ? 'bg-green-50/60 border-green-200' : 'bg-white border-gray-100'}`}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${draft.enabled ? 'bg-[#009846] text-white' : 'bg-gray-100 text-gray-400'}`}><Power size={20} /></div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-800">MittTV in the app is {draft.enabled ? 'ON' : 'OFF'}</p>
          <p className="text-xs text-gray-500">{draft.enabled
            ? 'The floating MittTV button shows on Home for the users ticked below.'
            : 'No one sees the MittTV button. Add your videos first, then switch it on.'}</p>
        </div>
        <Switch on={draft.enabled} onChange={(v) => setDraft((d) => ({ ...d, enabled: v }))} label="MittTV on" />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-5">
        <div>
          <Label>Who can see MittTV</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MITTTV_AUDIENCES.map((a) => (
              <label key={a.key} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer ${draft.audiences.includes(a.key) ? 'border-[#004f9f] bg-[#004f9f]/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="checkbox" checked={draft.audiences.includes(a.key)} onChange={() => toggleAudience(a.key)} className="accent-[#004f9f]" />
                <span className="text-sm font-semibold text-gray-700">{a.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Button text on Home</Label>
            <input value={draft.buttonLabel} maxLength={MITTTV_LIMITS.buttonLabel} onChange={(e) => setDraft((d) => ({ ...d, buttonLabel: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <Label>Title at the top of MittTV</Label>
            <input value={draft.screenTitle} maxLength={MITTTV_LIMITS.screenTitle} onChange={(e) => setDraft((d) => ({ ...d, screenTitle: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
          <Switch on={draft.searchEnabled} onChange={(v) => setDraft((d) => ({ ...d, searchEnabled: v }))} label="Search in MittTV" />
          <div>
            <p className="text-sm font-semibold text-gray-700 inline-flex items-center gap-1.5"><Search size={13} /> Search button {draft.searchEnabled ? 'on' : 'off'}</p>
            <p className="text-[11px] text-gray-400">The search icon at the top right of MittTV. It finds videos by title, description and tags.</p>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] text-gray-400">Preview — the app uses its theme colours (App Theme &amp; Festivals), shown here with the default ones.</span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-[#0b0b10] px-3 py-2.5 min-w-[220px] flex-1">
              <ChevronLeft size={18} className="text-white" />
              <PreviewTitle title={draft.screenTitle || 'MittTV'} />
              {draft.searchEnabled && <Search size={16} className="text-white ml-auto" />}
            </div>
            <div className="rounded-xl bg-[#FBF6EE] px-5 pt-3 pb-2.5 flex flex-col items-center" title="Users can drag this button anywhere on Home">
              <span className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1FAE8E] to-[#3E82E0] border-[3px] border-white shadow-lg flex items-center justify-center">
                <svg width="24" height="22" viewBox="0 0 30 28" aria-hidden="true">
                  <path d="M10 1.8 L15 6.8 L20 1.8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <rect x="2" y="7" width="26" height="19" rx="5.5" fill="#fff" />
                  <path d="M12.8 12 L19.6 16.5 L12.8 21 Z" fill="#3E82E0" stroke="#3E82E0" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="-mt-1.5 relative rounded-full bg-white shadow px-2 py-0.5 text-[11px] font-black tracking-tight">
                <PreviewLabel label={draft.buttonLabel || 'MittTV'} />
              </span>
            </div>
          </div>
        </div>

        {error && <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"><AlertCircle size={13} /> {error}</div>}
        <button onClick={save} disabled={!dirty || saving}
          className="w-full py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-40 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save settings
        </button>
        <p className="text-[11px] text-gray-400">The app checks these each time Home opens. Only app versions with MittTV show the button.</p>
      </div>
    </div>
  );
}

/** The screen title as the app draws it: "Mitt" in the first brand colour, the rest in the second. */
function PreviewTitle({ title }: { title: string }) {
  const [a, b] = splitTitle(title);
  return (
    <span className="text-lg font-black tracking-tight truncate">
      <span className="text-[#1FAE8E]">{a}</span><span className="text-[#3E82E0]">{b}</span>
    </span>
  );
}

// Same split as the app (MittTvCards.js → splitTitle).
function splitTitle(title: string): [string, string] {
  if (/^mitt./i.test(title)) return [title.slice(0, 4), title.slice(4)];
  const space = title.indexOf(' ');
  if (space > 0) return [title.slice(0, space), title.slice(space)];
  return [title, ''];
}

/** The Home button's name as the app draws it in the chip under the button. */
function PreviewLabel({ label }: { label: string }) {
  const [a, b] = splitTitle(label);
  return <><span className="text-[#1FAE8E]">{a}</span><span className="text-[#3E82E0]">{b}</span></>;
}
