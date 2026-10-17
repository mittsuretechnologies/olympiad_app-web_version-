'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Smartphone, Info, ShieldAlert } from 'lucide-react';
import { authFetch } from '@/lib/swr';

// SuperAdmin: force-update rule for the mobile app. Anyone on a build below
// the minimum sees a blocking "Update required" screen when they open the app.

interface Settings {
  androidMinBuild: number;
  iosMinBuild: number;
  message: string;
  iosStoreUrl: string;
  updatedAt: string | null;
}

const inputClass =
  'w-full h-11 px-4 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#004f9f] focus:ring-2 focus:ring-[#004f9f]/10';
const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5';

export default function AppVersionPage() {
  const [loaded, setLoaded] = useState<Settings | null>(null);
  const [android, setAndroid] = useState('0');
  const [ios, setIos] = useState('0');
  const [message, setMessage] = useState('');
  const [iosUrl, setIosUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const apply = (s: Settings) => {
    setLoaded(s);
    setAndroid(String(s.androidMinBuild));
    setIos(String(s.iosMinBuild));
    setMessage(s.message);
    setIosUrl(s.iosStoreUrl);
  };

  useEffect(() => {
    authFetch('/api/settings/app-version')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || 'Could not load settings');
        apply(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const androidNum = parseInt(android, 10);
  const iosNum = parseInt(ios, 10);
  const raisingAndroid = loaded && Number.isFinite(androidNum) && androidNum > loaded.androidMinBuild;
  const raisingIos = loaded && Number.isFinite(iosNum) && iosNum > loaded.iosMinBuild;

  const save = async () => {
    setError('');
    setSaved(false);
    if (!/^\d+$/.test(android.trim()) || !/^\d+$/.test(ios.trim())) {
      setError('Build numbers must be whole numbers (0 = no minimum).');
      return;
    }
    if ((raisingAndroid || raisingIos) && !confirm(
      'Everyone on an older build will be blocked until they update from the store. '
      + 'Make sure the new build is already LIVE on the store first. Continue?',
    )) return;

    setSaving(true);
    try {
      const r = await authFetch('/api/settings/app-version', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ androidMinBuild: androidNum, iosMinBuild: iosNum, message, iosStoreUrl: iosUrl }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Could not save');
      apply(d);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">App Version</h1>
        <p className="text-xs text-gray-400 mt-0.5">Force users on old app builds to update from the store</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs bg-gray-50 border-gray-100 text-gray-600">
        <Info size={14} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>
            Anyone whose app build is <strong>below</strong> the minimum sees a full-screen
            <strong> &ldquo;Update required&rdquo;</strong> page with only an Update button. <strong>0</strong> means no minimum.
          </p>
          <p>
            Enter the <strong>build number</strong>, not the version name: Android = <em>versionCode</em> (Play Console → Releases),
            iOS = <em>build number</em> (App Store Connect → TestFlight).
          </p>
          <p>Only app builds that include this check can be forced. Older installs are never affected.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Android — minimum build (versionCode)</label>
            <input className={inputClass} inputMode="numeric" value={android} onChange={(e) => setAndroid(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>iOS — minimum build number</label>
            <input className={inputClass} inputMode="numeric" value={ios} onChange={(e) => setIos(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelClass}>iOS App Store link (needed only to force iOS)</label>
          <input className={inputClass} placeholder="https://apps.apple.com/app/id…" value={iosUrl} onChange={(e) => setIosUrl(e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Message shown on the update screen</label>
          <textarea rows={3} maxLength={300}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:border-[#004f9f] focus:ring-2 focus:ring-[#004f9f]/10"
            value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        {(raisingAndroid || raisingIos) && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            Raising the minimum blocks everyone on an older build. Only do this once the new build is live on the store.
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle size={15} /> Saved. Apps check this every time they open.
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-gray-400 inline-flex items-center gap-1">
            <Smartphone size={12} />
            {loaded?.updatedAt ? `Last changed ${new Date(loaded.updatedAt).toLocaleString('en-IN')}` : 'Not set yet'}
          </p>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 h-11 px-6 bg-[#004f9f] text-white text-sm font-semibold rounded-lg hover:bg-[#003d7a] disabled:opacity-60 transition-colors">
            {saving && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
