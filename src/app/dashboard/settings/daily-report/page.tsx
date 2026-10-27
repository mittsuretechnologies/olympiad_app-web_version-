'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Mail, Send, Copy, Info } from 'lucide-react';
import { authFetch } from '@/lib/swr';

// SuperAdmin: the daily video report email — on/off, who gets it, and when.
// The app sends it on its own at the set IST time (see lib/dailyVideoReport.ts).

interface Settings {
  enabled: boolean;
  emails: string[];
  time: string;
  lastSent: string | null;
  lastError: string | null;
}

const inputClass =
  'w-full h-11 px-4 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#004f9f] focus:ring-2 focus:ring-[#004f9f]/10';
const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5';

const formatDay = (key: string) =>
  new Date(`${key}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export default function DailyReportPage() {
  const [loaded, setLoaded] = useState<Settings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [emails, setEmails] = useState('');
  const [time, setTime] = useState('18:00');
  const [preview, setPreview] = useState('');
  const [mailerConfigured, setMailerConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const apply = (s: Settings) => {
    setLoaded(s);
    setEnabled(s.enabled);
    setEmails(s.emails.join('\n'));
    setTime(s.time);
  };

  useEffect(() => {
    authFetch('/api/settings/daily-report')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || 'Could not load settings');
        apply(d.settings);
        setPreview(d.preview);
        setMailerConfigured(d.mailerConfigured);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const dirty = loaded && (
    enabled !== loaded.enabled || time !== loaded.time
    || emails.split(/[\s,;]+/).filter(Boolean).join(',').toLowerCase() !== loaded.emails.join(',')
  );

  const save = async () => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const r = await authFetch('/api/settings/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, emails, time }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Could not save');
      apply(d.settings);
      setNotice(d.settings.enabled ? `Saved. The report will be emailed every day at ${to12h(d.settings.time)} IST.` : 'Saved. The daily report is off.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    setError('');
    setNotice('');
    if (dirty) { setError('Save your changes first.'); return; }
    setSending(true);
    try {
      const r = await authFetch('/api/settings/daily-report/send', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Could not send');
      setNotice(`Report sent to ${d.sentTo.join(', ')}.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — the text can still be selected by hand */ }
  };

  if (loading) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">Daily Report</h1>
        <p className="text-xs text-gray-400 mt-0.5">Email the daily Mittmee video report automatically, every day including Sundays</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs bg-gray-50 border-gray-100 text-gray-600">
        <Info size={14} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>The report counts total, today&apos;s, approved, rejected and pending videos, with the upload time of each pending video. Deleted videos are not counted.</p>
          <p>It is sent by the server, so nobody&apos;s computer needs to be on.</p>
        </div>
      </div>

      {!mailerConfigured && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <AlertCircle size={15} /> Email (SMTP) is not set up on this server, so the report cannot be sent.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-5">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-gray-800">Send the daily report</p>
            <p className="text-xs text-gray-400">{enabled ? 'On' : 'Off'}</p>
          </div>
          <button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled(!enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-[#009846]' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
          </button>
        </label>

        <div className="grid sm:grid-cols-[1fr_180px] gap-4">
          <div>
            <label className={labelClass}>Send to (one email per line)</label>
            <textarea rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#004f9f] focus:ring-2 focus:ring-[#004f9f]/10"
              placeholder="name@mittsure.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Time (IST)</label>
            <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle size={15} /> {notice}
          </div>
        )}
        {loaded?.lastError && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle size={14} /> Last scheduled send failed — {loaded.lastError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400 inline-flex items-center gap-1">
            <Mail size={12} />
            {loaded?.lastSent ? `Last sent automatically on ${formatDay(loaded.lastSent)}` : 'Not sent automatically yet'}
          </p>
          <div className="flex gap-2">
            <button onClick={sendNow} disabled={sending || !mailerConfigured}
              className="inline-flex items-center gap-2 h-11 px-5 border border-[#004f9f] text-[#004f9f] text-sm font-semibold rounded-lg hover:bg-[#004f9f]/5 disabled:opacity-60 transition-colors">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send now
            </button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 h-11 px-6 bg-[#004f9f] text-white text-sm font-semibold rounded-lg hover:bg-[#003d7a] disabled:opacity-60 transition-colors">
              {saving && <Loader2 size={15} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">Report right now</p>
          <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004f9f] hover:underline">
            <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="whitespace-pre-wrap text-[13px] leading-relaxed font-mono text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-4">{preview}</pre>
      </div>
    </div>
  );
}

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
