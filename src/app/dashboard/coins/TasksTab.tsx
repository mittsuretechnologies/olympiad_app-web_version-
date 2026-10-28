'use client';

import { useState } from 'react';
import { Card, Btn, DateField, ErrorBox, Field, Loading, Modal, Num, Pill, Select, Text, Toggle, api, fmtDate, useLoad } from './ui';

const EVENTS: [string, string][] = [
  ['OPEN_APP', 'Open the app'], ['WATCH_VIDEO', 'Watch a video'], ['LIKE_VIDEO', 'Like a video'], ['FOLLOW', 'Follow someone'],
  ['UPLOAD_VIDEO', 'Upload a video'], ['SHARE', 'Share'], ['PLAY_GAME', 'Play a game'], ['CUSTOM', 'Custom'],
];
const blank = () => ({
  title: '', description: '', icon: 'star', eventType: 'WATCH_VIDEO', target: 1, coins: 5, frequency: 'DAILY',
  active: true, startsAt: null as string | null, endsAt: null as string | null, sortOrder: 0,
});

export default function TasksTab() {
  const { data, error, loading, reload } = useLoad<any>('/api/dashboard/coins/tasks');
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true); setErr('');
    try {
      const { id, createdAt, updatedAt, ...body } = edit;
      await api(id ? `/api/dashboard/coins/tasks/${id}` : '/api/dashboard/coins/tasks', id ? 'PUT' : 'POST', body);
      setEdit(null); reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function remove(t: any) {
    if (!confirm(`Delete "${t.title}"? Everyone's progress on it is deleted too. Switching it off keeps history.`)) return;
    try { await api(`/api/dashboard/coins/tasks/${t.id}`, 'DELETE'); reload(); } catch (e: any) { alert(e.message); }
  }
  async function toggle(t: any) {
    const { id, createdAt, updatedAt, ...body } = t;
    try { await api(`/api/dashboard/coins/tasks/${id}`, 'PUT', { ...body, active: !t.active }); reload(); } catch (e: any) { alert(e.message); }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  const set = (p: any) => setEdit({ ...edit, ...p });

  return (
    <div className="space-y-4">
      <Card title="Tasks" hint="A task is “do this N times (daily / weekly / once), then tap Claim”. Likes, follows, uploads and video watches are counted by the server from real activity."
        right={<Btn onClick={() => { setErr(''); setEdit(blank()); }}>+ New task</Btn>}>
        <div className="divide-y">
          {data?.tasks.length === 0 && <p className="py-6 text-center text-gray-400 text-sm">No tasks yet.</p>}
          {data?.tasks.map((t: any) => (
            <div key={t.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{t.title}</div>
                <div className="text-xs text-gray-500">
                  {EVENTS.find((e) => e[0] === t.eventType)?.[1]} × {t.target} · {t.frequency.toLowerCase()}
                  {(t.startsAt || t.endsAt) && ` · ${fmtDate(t.startsAt)} → ${fmtDate(t.endsAt)}`}
                </div>
              </div>
              <Pill tone="green">+{t.coins} coins</Pill>
              <Toggle checked={t.active} onChange={() => toggle(t)} label="" />
              <Btn tone="ghost" small onClick={() => { setErr(''); setEdit({ ...t, description: t.description ?? '', icon: t.icon ?? '' }); }}>Edit</Btn>
              <Btn tone="danger" small onClick={() => remove(t)}>Delete</Btn>
            </div>
          ))}
        </div>
      </Card>

      {edit && (
        <Modal title={edit.id ? 'Edit task' : 'New task'} onClose={() => setEdit(null)}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Field label="Title"><Text value={edit.title} onChange={(v) => set({ title: v })} placeholder="Watch 3 videos" /></Field></div>
            <div className="sm:col-span-2"><Field label="Description (optional)"><Text value={edit.description} onChange={(v) => set({ description: v })} /></Field></div>
            <Field label="Counts when the user…">
              <Select value={edit.eventType} onChange={(v) => set({ eventType: v })} options={EVENTS.map(([value, label]) => ({ value, label }))} />
            </Field>
            <Field label="Repeats">
              <Select value={edit.frequency} onChange={(v) => set({ frequency: v })} options={[
                { value: 'DAILY', label: 'Every day' }, { value: 'WEEKLY', label: 'Every week' }, { value: 'ONCE', label: 'Only once ever' },
              ]} />
            </Field>
            <Field label="Times needed"><Num value={edit.target} min={1} onChange={(v) => set({ target: v })} /></Field>
            <Field label="Coins rewarded"><Num value={edit.coins} min={1} onChange={(v) => set({ coins: v })} /></Field>
            <Field label="Starts (optional)"><DateField value={edit.startsAt} onChange={(v) => set({ startsAt: v })} /></Field>
            <Field label="Ends (optional)"><DateField value={edit.endsAt} onChange={(v) => set({ endsAt: v })} /></Field>
            <Field label="Icon name" hint="Ionicons name, e.g. play, heart, share-social, star"><Text value={edit.icon} onChange={(v) => set({ icon: v })} /></Field>
            <Field label="Order" hint="Lower shows first"><Num value={edit.sortOrder} min={-1000} onChange={(v) => set({ sortOrder: v })} /></Field>
          </div>
          <div className="mt-4"><Toggle checked={edit.active} onChange={(v) => set({ active: v })} label="Active" /></div>
          <div className="mt-5 flex items-center gap-3">
            <Btn onClick={save} busy={busy} disabled={!edit.title.trim()}>Save task</Btn>
            <Btn tone="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
            <ErrorBox message={err} />
          </div>
        </Modal>
      )}
    </div>
  );
}
