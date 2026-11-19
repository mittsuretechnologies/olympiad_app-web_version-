'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Info, Trophy } from 'lucide-react';
import { authFetch } from '@/lib/swr';

// SuperAdmin: show or hide the "Is this video for MittFest?" checkbox on the
// app's upload screen.

interface Settings {
  checkboxEnabled: boolean;
  updatedAt: string | null;
}

export default function MittfestSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    authFetch('/api/settings/mittfest')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || 'Could not load settings');
        setSettings(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async () => {
    if (!settings) return;
    const next = !settings.checkboxEnabled;
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const r = await authFetch('/api/settings/mittfest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkboxEnabled: next }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Could not save');
      setSettings(d);
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

  const on = settings?.checkboxEnabled ?? true;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">MittFest</h1>
        <p className="text-xs text-gray-400 mt-0.5">Control the MittFest option on the app&apos;s upload screen</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs bg-gray-50 border-gray-100 text-gray-600">
        <Info size={14} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>
            When this is <strong>on</strong>, the upload screen shows
            <strong> &ldquo;Is this video for MittFest?&rdquo;</strong> and a ticked video is submitted for MittFest.
          </p>
          <p>
            When it is <strong>off</strong>, the checkbox is hidden and a tick from an older app is ignored.
            A <strong>#mittfest</strong> hashtag still marks a video for MittFest either way.
          </p>
        </div>
      </div>

      {settings && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <Trophy size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Show &ldquo;Is this video for MittFest?&rdquo; checkbox</p>
                <p className="text-xs text-gray-400">{on ? 'Shown on the upload screen' : 'Hidden from the upload screen'}</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              onClick={toggle}
              disabled={saving}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-[#009846]' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle size={15} /> Saved. The app picks this up the next time the upload screen opens.
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            {settings.updatedAt ? `Last changed ${new Date(settings.updatedAt).toLocaleString('en-IN')}` : 'Not changed yet (on by default)'}
          </p>
        </div>
      )}

      {!settings && error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle size={15} /> {error}
        </div>
      )}
    </div>
  );
}
