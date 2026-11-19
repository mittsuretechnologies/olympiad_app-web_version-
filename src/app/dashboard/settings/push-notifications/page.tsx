'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Info, BellRing, Send, ShieldAlert } from 'lucide-react';
import { authFetch } from '@/lib/swr';

// SuperAdmin: send a push notification (plus an in-app notification) to
// every app user, or only students / general users.

type Audience = 'ALL' | 'STUDENTS' | 'GENERAL';
interface PushInfo {
  configured: boolean;
  counts: Record<Audience, { users: number; devices: number }>;
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL: 'Everyone',
  STUDENTS: 'Olympiad students',
  GENERAL: 'General users',
};

const inputClass =
  'w-full h-11 px-4 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#004f9f] focus:ring-2 focus:ring-[#004f9f]/10';
const labelClass = 'block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5';

export default function PushNotificationsPage() {
  const [info, setInfo] = useState<PushInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('ALL');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ users: number; delivered: number } | null>(null);

  const load = () =>
    authFetch('/api/settings/push-notifications')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || 'Could not load');
        setInfo(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const send = async () => {
    setError('');
    setResult(null);
    if (!title.trim() || !message.trim()) {
      setError('Write a title and a message first.');
      return;
    }
    const reach = info?.counts[audience];
    if (!confirm(
      `Send "${title.trim()}" to ${AUDIENCE_LABEL[audience].toLowerCase()}`
      + (reach ? ` (${reach.users} accounts, ${reach.devices} phones)` : '')
      + '? This cannot be undone.',
    )) return;

    setSending(true);
    try {
      const r = await authFetch('/api/settings/push-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, audience }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Could not send');
      setResult(d);
      setTitle('');
      setMessage('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">Push Notifications</h1>
        <p className="text-xs text-gray-400 mt-0.5">Send an announcement to app users&apos; phones</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs bg-gray-50 border-gray-100 text-gray-600">
        <Info size={14} className="mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>
            The message pops up on the phone of everyone in the audience who has the new app and allowed notifications,
            and is also added to their <strong>notification list</strong> in the app.
          </p>
          <p>Likes, video approvals, follows and shared videos send their own notifications automatically.</p>
        </div>
      </div>

      {info && !info.configured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          Firebase is not set up on this server yet (FIREBASE_SERVICE_ACCOUNT in .env), so phones won&apos;t get a push.
          Sending still adds the message to everyone&apos;s in-app notification list.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-5">
        <div>
          <label className={labelClass}>Send to</label>
          <div className="grid sm:grid-cols-3 gap-2">
            {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${audience === a ? 'border-[#004f9f] bg-[#004f9f]/5' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <p className={`text-sm font-semibold ${audience === a ? 'text-[#004f9f]' : 'text-gray-800'}`}>{AUDIENCE_LABEL[a]}</p>
                {info && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {info.counts[a].users.toLocaleString('en-IN')} accounts · {info.counts[a].devices.toLocaleString('en-IN')} phones
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Title</label>
          <input className={inputClass} maxLength={80} placeholder="e.g. MittFest entries are open!"
            value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Message</label>
          <textarea rows={3} maxLength={300}
            placeholder="e.g. Upload your best video before 30 November and win prizes."
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#004f9f] focus:ring-2 focus:ring-[#004f9f]/10"
            value={message} onChange={(e) => setMessage(e.target.value)} />
          <p className="text-[11px] text-gray-400 mt-1 text-right">{message.length}/300</p>
        </div>

        {/* Rough preview of how it looks on a phone */}
        {(title || message) && (
          <div className="rounded-2xl bg-gray-100 p-3">
            <div className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-[#004f9f] text-white flex items-center justify-center shrink-0">
                <BellRing size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-400">MittMee · now</p>
                <p className="text-sm font-semibold text-gray-800 truncate">{title || 'Title'}</p>
                <p className="text-xs text-gray-600 line-clamp-2">{message || 'Message'}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertCircle size={15} /> {error}
          </div>
        )}
        {result && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle size={15} />
            Sent. Added to {result.users.toLocaleString('en-IN')} notification lists; pushed to {result.delivered.toLocaleString('en-IN')} phones.
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={send} disabled={sending}
            className="inline-flex items-center gap-2 h-11 px-6 bg-[#004f9f] text-white text-sm font-semibold rounded-lg hover:bg-[#003d7a] disabled:opacity-60 transition-colors">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send notification
          </button>
        </div>
      </div>
    </div>
  );
}
