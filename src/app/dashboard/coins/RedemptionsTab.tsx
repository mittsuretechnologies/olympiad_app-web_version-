'use client';

import { useState } from 'react';
import { Card, Btn, ErrorBox, Field, Loading, Modal, Pill, Select, Text, api, fmtDate, useLoad } from './ui';

const TONE: Record<string, 'amber' | 'green' | 'gray'> = { PENDING: 'amber', FULFILLED: 'green', CANCELLED: 'gray' };

export default function RedemptionsTab() {
  const [status, setStatus] = useState('PENDING');
  const { data, error, loading, reload } = useLoad<any>(`/api/dashboard/coins/redemptions${status ? `?status=${status}` : ''}`);
  const [act, setAct] = useState<{ row: any; action: 'FULFIL' | 'CANCEL' } | null>(null);
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!act) return;
    setBusy(true); setErr('');
    try {
      await api(`/api/dashboard/coins/redemptions/${act.row.id}`, 'PATCH', { action: act.action, note: note || null, code: code || null });
      setAct(null); reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card title="Redemptions" hint="Coupon rewards are fulfilled automatically. Manual rewards wait here as Pending: deliver them, then mark fulfilled — or cancel to refund the coins."
        right={<div className="w-40"><Select value={status} onChange={setStatus} options={[
          { value: 'PENDING', label: 'Pending' }, { value: 'FULFILLED', label: 'Fulfilled' }, { value: 'CANCELLED', label: 'Cancelled' }, { value: '', label: 'All' },
        ]} /></div>}>
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} /> : (
          <div className="divide-y">
            {data.redemptions.length === 0 && <p className="py-6 text-center text-gray-400 text-sm">Nothing here.</p>}
            {data.redemptions.map((r: any) => (
              <div key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-semibold text-gray-900">{r.reward.title}</div>
                  <div className="text-xs text-gray-500">
                    {r.appUser.userId} · {r.appUser.mobile ?? r.appUser.email ?? '—'} · {fmtDate(r.createdAt)}
                    {r.code && <> · code <span className="font-mono">{r.code}</span></>}
                  </div>
                  {r.adminNote && <div className="text-xs text-gray-500 mt-0.5">Note: {r.adminNote}</div>}
                </div>
                <span className="text-sm text-gray-600">{r.coinsSpent} coins</span>
                <Pill tone={TONE[r.status]}>{r.status.toLowerCase()}</Pill>
                {r.status === 'PENDING' && (
                  <>
                    <Btn small onClick={() => { setNote(''); setCode(''); setErr(''); setAct({ row: r, action: 'FULFIL' }); }}>Mark fulfilled</Btn>
                    <Btn small tone="danger" onClick={() => { setNote(''); setCode(''); setErr(''); setAct({ row: r, action: 'CANCEL' }); }}>Cancel & refund</Btn>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {act && (
        <Modal title={act.action === 'FULFIL' ? 'Mark as fulfilled' : 'Cancel and refund coins'} onClose={() => setAct(null)}>
          <p className="text-sm text-gray-600 mb-3">{act.row.reward.title} — {act.row.appUser.userId}</p>
          {act.action === 'FULFIL' && (
            <div className="mb-3"><Field label="Code / receipt shown to the user (optional)"><Text value={code} onChange={setCode} placeholder="Gift-card code or link" /></Field></div>
          )}
          <Field label={act.action === 'CANCEL' ? 'Reason (shown to the user)' : 'Note (optional)'}><Text value={note} onChange={setNote} /></Field>
          <div className="mt-4 flex items-center gap-3">
            <Btn onClick={submit} busy={busy} tone={act.action === 'CANCEL' ? 'danger' : 'primary'}>{act.action === 'FULFIL' ? 'Confirm' : 'Cancel & refund'}</Btn>
            <Btn tone="ghost" onClick={() => setAct(null)}>Back</Btn>
            <ErrorBox message={err} />
          </div>
        </Modal>
      )}
    </div>
  );
}
