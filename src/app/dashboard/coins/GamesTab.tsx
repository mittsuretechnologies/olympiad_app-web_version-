'use client';

import { useState } from 'react';
import { Card, Btn, ErrorBox, Field, Loading, Modal, Num, Pill, Text, Toggle, api, useLoad } from './ui';

const blank = () => ({
  gameKey: '', title: '', active: true, maxPlaysPerDay: 5, maxCoinsPerDay: 50, minSeconds: 0,
  bands: [{ minScore: 0, coins: 1 }, { minScore: 50, coins: 3 }] as { minScore: number; coins: number }[],
  isNew: true,
});

export default function GamesTab() {
  const { data, error, loading, reload } = useLoad<any>('/api/dashboard/coins/games');
  const [edit, setEdit] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true); setErr('');
    try {
      const { isNew, updatedAt, ...body } = edit;
      await api('/api/dashboard/coins/games', 'PUT', body);
      setEdit(null); reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function remove(g: any) {
    if (!confirm(`Remove coin rules for "${g.title}"?`)) return;
    try { await api(`/api/dashboard/coins/games?gameKey=${encodeURIComponent(g.gameKey)}`, 'DELETE'); reload(); } catch (e: any) { alert(e.message); }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  const set = (p: any) => setEdit({ ...edit, ...p });
  const setBand = (i: number, p: any) => set({ bands: edit.bands.map((b: any, j: number) => (j === i ? { ...b, ...p } : b)) });

  return (
    <div className="space-y-4">
      <Card title="Game coin rules"
        hint="A game reports its score; the server turns it into coins using these score bands and limits. The game key is the id the game sends (e.g. “quiz”)."
        right={<Btn onClick={() => { setErr(''); setEdit(blank()); }}>+ New game</Btn>}>
        <div className="divide-y">
          {data.games.length === 0 && <p className="py-6 text-center text-gray-400 text-sm">No games yet.</p>}
          {data.games.map((g: any) => (
            <div key={g.gameKey} className="py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[10rem]">
                <div className="font-semibold text-gray-900">{g.title} <span className="font-mono text-xs text-gray-400">{g.gameKey}</span></div>
                <div className="text-xs text-gray-500">{g.maxPlaysPerDay} plays/day · max {g.maxCoinsPerDay} coins/day · {(g.bands as any[]).length} score bands</div>
              </div>
              {!g.active && <Pill tone="red">Off</Pill>}
              <Btn tone="ghost" small onClick={() => { setErr(''); setEdit({ ...g, isNew: false }); }}>Edit</Btn>
              <Btn tone="danger" small onClick={() => remove(g)}>Delete</Btn>
            </div>
          ))}
        </div>
      </Card>

      {edit && (
        <Modal title={edit.isNew ? 'New game' : `Edit ${edit.title}`} onClose={() => setEdit(null)}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Game key" hint="Lowercase, no spaces. Can't be changed later.">
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono disabled:bg-gray-50" value={edit.gameKey} disabled={!edit.isNew}
                onChange={(e) => set({ gameKey: e.target.value.toLowerCase() })} />
            </Field>
            <Field label="Name"><Text value={edit.title} onChange={(v) => set({ title: v })} /></Field>
            <Field label="Max plays that earn coins, per day"><Num value={edit.maxPlaysPerDay} min={1} onChange={(v) => set({ maxPlaysPerDay: v })} /></Field>
            <Field label="Max coins per day from this game"><Num value={edit.maxCoinsPerDay} onChange={(v) => set({ maxCoinsPerDay: v })} /></Field>
            <Field label="Minimum play time (seconds)" hint="Rounds shorter than this earn nothing"><Num value={edit.minSeconds} onChange={(v) => set({ minSeconds: v })} /></Field>
          </div>
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-700 mb-2">Score bands (the highest band reached wins)</div>
            {edit.bands.map((b: any, i: number) => (
              <div key={i} className="flex items-end gap-3 mb-2">
                <Field label="Score at least"><Num value={b.minScore} onChange={(v) => setBand(i, { minScore: v })} /></Field>
                <Field label="Coins"><Num value={b.coins} onChange={(v) => setBand(i, { coins: v })} /></Field>
                <Btn tone="danger" small disabled={edit.bands.length === 1} onClick={() => set({ bands: edit.bands.filter((_: any, j: number) => j !== i) })}>Remove</Btn>
              </div>
            ))}
            <Btn tone="ghost" small onClick={() => set({ bands: [...edit.bands, { minScore: 100, coins: 5 }] })}>+ Add band</Btn>
          </div>
          <div className="mt-4"><Toggle checked={edit.active} onChange={(v) => set({ active: v })} label="Active" /></div>
          <div className="mt-5 flex items-center gap-3">
            <Btn onClick={save} busy={busy} disabled={!edit.gameKey || !edit.title.trim()}>Save</Btn>
            <Btn tone="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
            <ErrorBox message={err} />
          </div>
        </Modal>
      )}
    </div>
  );
}
