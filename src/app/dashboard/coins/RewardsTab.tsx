'use client';

import { useState } from 'react';
import { Card, Btn, DateField, ErrorBox, Field, Loading, Modal, Num, Pill, Select, Text, Toggle, api, inr, useLoad } from './ui';

const blank = () => ({
  title: '', description: '', imageUrl: '', kind: 'COUPON', costCoins: 100, stock: null as number | null, perUserLimit: 1,
  startsAt: null as string | null, endsAt: null as string | null, active: true, sortOrder: 0, terms: '', instructions: '',
});

export default function RewardsTab() {
  const { data, error, loading, reload } = useLoad<any>('/api/dashboard/coins/rewards');
  const rate = useLoad<any>('/api/dashboard/coins/settings').data?.config?.inrPerCoin ?? 0;
  const [edit, setEdit] = useState<any>(null);
  const [codesFor, setCodesFor] = useState<any>(null);
  const [codesText, setCodesText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [codeList, setCodeList] = useState<any[] | null>(null);

  async function loadCodes(id: string) {
    setCodeList(null);
    try { setCodeList((await api(`/api/dashboard/coins/rewards/${id}/codes`)).codes); } catch (e: any) { setErr(e.message); }
  }
  async function removeCode(c: any) {
    if (!confirm(`Remove code ${c.code}?`)) return;
    try { await api(`/api/dashboard/coins/rewards/${codesFor.id}/codes?codeId=${c.id}`, 'DELETE'); loadCodes(codesFor.id); reload(); } catch (e: any) { setErr(e.message); }
  }

  async function save() {
    setBusy(true); setErr('');
    try {
      const { id, createdAt, updatedAt, codesLeft, redeemedCount, ...body } = edit;
      await api(id ? `/api/dashboard/coins/rewards/${id}` : '/api/dashboard/coins/rewards', id ? 'PUT' : 'POST', body);
      setEdit(null); reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function remove(r: any) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    try { await api(`/api/dashboard/coins/rewards/${r.id}`, 'DELETE'); reload(); } catch (e: any) { alert(e.message); }
  }
  async function addCodes() {
    setBusy(true); setErr(''); setNote('');
    try {
      const codes = codesText.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean);
      const r = await api(`/api/dashboard/coins/rewards/${codesFor.id}/codes`, 'POST', { codes });
      setNote(`Added ${r.added} code(s)${r.skipped ? `, skipped ${r.skipped} duplicate(s)` : ''}.`);
      setCodesText(''); reload(); loadCodes(codesFor.id);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  const set = (p: any) => setEdit({ ...edit, ...p });

  return (
    <div className="space-y-4">
      <Card title="Rewards" hint="Coupon rewards hand out a code from the pool you upload, instantly. Manual rewards (gift cards, donations…) appear under Redemptions for you to fulfil."
        right={<Btn onClick={() => { setErr(''); setEdit(blank()); }}>+ New reward</Btn>}>
        <div className="divide-y">
          {data?.rewards.length === 0 && <p className="py-6 text-center text-gray-400 text-sm">No rewards yet.</p>}
          {data?.rewards.map((r: any) => (
            <div key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[12rem]">
                <div className="font-semibold text-gray-900">{r.title}</div>
                <div className="text-xs text-gray-500">
                  {r.kind === 'COUPON' ? `${r.codesLeft} codes left` : r.stock === null ? 'Unlimited' : `${r.stock} left`} · {r.redeemedCount} redeemed
                </div>
              </div>
              <Pill tone="blue">{r.costCoins} coins{rate ? ` · ${inr(r.costCoins * rate)}` : ''}</Pill>
              {!r.active && <Pill tone="red">Off</Pill>}
              {r.kind === 'COUPON' && <Btn tone="ghost" small onClick={() => { setErr(''); setNote(''); setCodesText(''); setCodesFor(r); loadCodes(r.id); }}>Codes</Btn>}
              <Btn tone="ghost" small onClick={() => { setErr(''); setEdit({ ...r, description: r.description ?? '', imageUrl: r.imageUrl ?? '', terms: r.terms ?? '', instructions: r.instructions ?? '' }); }}>Edit</Btn>
              <Btn tone="danger" small onClick={() => remove(r)}>Delete</Btn>
            </div>
          ))}
        </div>
      </Card>

      {edit && (
        <Modal title={edit.id ? 'Edit reward' : 'New reward'} onClose={() => setEdit(null)} wide>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Field label="Title"><Text value={edit.title} onChange={(v) => set({ title: v })} placeholder="₹50 off on Amazon" /></Field></div>
            <div className="sm:col-span-2"><Field label="Description"><Text multiline value={edit.description} onChange={(v) => set({ description: v })} /></Field></div>
            <Field label="Type">
              <Select value={edit.kind} onChange={(v) => set({ kind: v })} options={[
                { value: 'COUPON', label: 'Coupon (code handed out instantly)' }, { value: 'MANUAL', label: 'Manual (you fulfil it)' },
              ]} />
            </Field>
            <Field label="Price in coins" hint={rate ? `= ${inr(edit.costCoins * rate)}` : undefined}><Num value={edit.costCoins} min={1} onChange={(v) => set({ costCoins: v })} /></Field>
            {edit.kind === 'MANUAL' && (
              <Field label="Stock" hint="Leave 0 for none left; clear for unlimited">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" type="number" min={0} value={edit.stock ?? ''} placeholder="Unlimited"
                  onChange={(e) => set({ stock: e.target.value === '' ? null : Number(e.target.value) })} />
              </Field>
            )}
            <Field label="Max per user" hint="0 = unlimited"><Num value={edit.perUserLimit} onChange={(v) => set({ perUserLimit: v })} /></Field>
            <Field label="Available from"><DateField value={edit.startsAt} onChange={(v) => set({ startsAt: v })} /></Field>
            <Field label="Available until"><DateField value={edit.endsAt} onChange={(v) => set({ endsAt: v })} /></Field>
            <Field label="Image URL"><Text value={edit.imageUrl} onChange={(v) => set({ imageUrl: v })} placeholder="https://…" /></Field>
            <Field label="Order" hint="Lower shows first"><Num value={edit.sortOrder} min={-1000} onChange={(v) => set({ sortOrder: v })} /></Field>
            <div className="sm:col-span-2"><Field label="How to use (shown after redeeming)"><Text multiline value={edit.instructions} onChange={(v) => set({ instructions: v })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Terms"><Text multiline value={edit.terms} onChange={(v) => set({ terms: v })} /></Field></div>
          </div>
          <div className="mt-4"><Toggle checked={edit.active} onChange={(v) => set({ active: v })} label="Active (visible in the app)" /></div>
          <div className="mt-5 flex items-center gap-3">
            <Btn onClick={save} busy={busy} disabled={!edit.title.trim()}>Save reward</Btn>
            <Btn tone="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
            <ErrorBox message={err} />
          </div>
        </Modal>
      )}

      {codesFor && (
        <Modal title={`Coupon codes — ${codesFor.title}`} onClose={() => setCodesFor(null)}>
          <p className="text-sm text-gray-600 mb-2">{codesFor.codesLeft} unused codes in the pool. Paste new codes below — one per line (commas also work). Duplicates are skipped.</p>
          <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono h-40" value={codesText} onChange={(e) => setCodesText(e.target.value)} placeholder={'SAVE50-AAAA\nSAVE50-BBBB'} />
          <div className="mt-3 flex items-center gap-3">
            <Btn onClick={addCodes} busy={busy} disabled={!codesText.trim()}>Add codes</Btn>
            <Btn tone="ghost" onClick={() => setCodesFor(null)}>Close</Btn>
            {note && <span className="text-sm text-green-700">{note}</span>}
          </div>
          <div className="mt-3"><ErrorBox message={err} /></div>

          <div className="mt-5 border-t pt-4">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              Codes in this pool{codeList ? ` (${codeList.filter((c) => !c.used).length} unused, ${codeList.filter((c) => c.used).length} given out)` : ''}
            </div>
            {!codeList ? <p className="text-sm text-gray-400">Loading…</p> : codeList.length === 0 ? <p className="text-sm text-gray-400">No codes yet.</p> : (
              <div className="max-h-64 overflow-y-auto divide-y border rounded-lg">
                {codeList.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                    <span className={`font-mono text-sm flex-1 select-all ${c.used ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{c.code}</span>
                    {c.used ? <Pill tone="gray">Given out</Pill> : <Pill tone="green">Unused</Pill>}
                    {!c.used && <Btn tone="danger" small onClick={() => removeCode(c)}>Remove</Btn>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
