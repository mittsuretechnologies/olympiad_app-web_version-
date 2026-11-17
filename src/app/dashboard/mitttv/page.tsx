'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Film, GalleryHorizontal, Info, Loader2, Rows3, Settings, Tv } from 'lucide-react';
import { api, type Snapshot, type TvVideo } from './_lib/api';
import VideosTab from './_components/VideosTab';
import BannerTab from './_components/BannerTab';
import RowsTab from './_components/RowsTab';
import SettingsTab from './_components/SettingsTab';

// SuperAdmin → MittTV: the app's Netflix-style video screen, opened from the
// floating MittTV button on Home. Videos, the big banner, the rows under it
// and who sees it. Server side: src/lib/mittTv.ts, mittTvAdmin.ts, mittTvShared.ts.

type Tab = 'videos' | 'banner' | 'rows' | 'settings';
const TABS: { key: Tab; label: string; icon: typeof Film }[] = [
  { key: 'videos', label: 'Videos', icon: Film },
  { key: 'banner', label: 'Banner', icon: GalleryHorizontal },
  { key: 'rows', label: 'Screen Rows', icon: Rows3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function MittTvPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('videos');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setLoadError('');
    try { setData(await api<Snapshot>('/api/dashboard/mitttv')); }
    catch (e: any) { setLoadError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const videoMap = useMemo(() => new Map((data?.videos ?? []).map((v) => [v.id, v])), [data]);
  const banner = data?.rows.find((r) => r.kind === 'BANNER');

  // A saved video changes row membership too, so the rows are re-read quietly.
  const onVideoSaved = (v: TvVideo) => {
    setData((d) => d && ({
      ...d,
      videos: d.videos.some((x) => x.id === v.id)
        ? d.videos.map((x) => (x.id === v.id ? { ...v, views7d: x.views7d } : x))
        : [v, ...d.videos],
    }));
    load(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1FAE8E] to-[#3E82E0] text-white flex items-center justify-center shadow"><Tv size={20} /></div>
          <div>
            <h1 className="text-2xl font-medium text-[#004f9f]">MittTV</h1>
            <p className="text-xs text-gray-400 mt-0.5">The app&apos;s video screen — videos, banner, rows and who sees it</p>
          </div>
        </div>
        {data && (
          <span className={`px-3 py-1 text-xs font-bold rounded-full border ${data.settings.enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {data.settings.enabled ? 'Live in app' : 'Off in app'}
          </span>
        )}
      </div>

      {data && !data.settings.enabled && (
        <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs bg-amber-50 border-amber-200 text-amber-800">
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>MittTV is switched <strong>off</strong>, so the app shows no MittTV button yet. Add videos and set up the rows, then switch it on in <button className="underline font-semibold" onClick={() => setTab('settings')}>Settings</button>.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${tab === key ? 'bg-[#004f9f] text-white border-[#004f9f]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            <Icon size={15} /> {label}
            {key === 'videos' && data && <span className={`text-[11px] px-1.5 rounded-full ${tab === key ? 'bg-white/20' : 'bg-gray-100'}`}>{data.videos.length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : loadError || !data ? (
        <div className="py-16 flex flex-col items-center gap-2 text-red-500 text-sm">
          <AlertCircle size={18} /> {loadError || 'Could not load MittTV'}
          <button onClick={() => load()} className="text-xs text-[#004f9f] underline">Try again</button>
        </div>
      ) : tab === 'videos' ? (
        <VideosTab videos={data.videos} rows={data.rows} onSaved={onVideoSaved}
          onDeleted={(id) => { setData((d) => d && ({ ...d, videos: d.videos.filter((v) => v.id !== id) })); load(true); }} />
      ) : tab === 'banner' ? (
        banner ? <BannerTab row={banner} videos={data.videos} videoMap={videoMap} onSaved={() => load(true)} /> : null
      ) : tab === 'rows' ? (
        <RowsTab rows={data.rows} videos={data.videos} videoMap={videoMap} onChanged={() => load(true)} />
      ) : (
        <SettingsTab settings={data.settings} onSaved={(s) => setData((d) => d && ({ ...d, settings: s }))} />
      )}
    </div>
  );
}
