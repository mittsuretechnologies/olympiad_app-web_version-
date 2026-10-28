'use client';

import { useState } from 'react';
import { Card, Btn, ErrorBox, Field, Loading, Modal, Num, Pill, Text, api, fmtDate, useLoad } from './ui';

export default function UsersTab() {
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const { data, error, loading } = useLoad<any>(`/api/dashboard/coins/users${applied ? `?q=${encodeURIComponent(applied)}` : ''}`);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card title="Wallets" hint="Search by user ID, mobile number or email. With no search, the biggest balances show first.">
        <form className="flex gap-2 mb-4 max-w-md" onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); }}>
          <Text value={q} onChange={setQ} placeholder="User ID, mobile or email" />
          <Btn onClick={() => setApplied(q.trim())}>Search</Btn>
        </form>
        {loading && !data ? <Loading /> : error ? <ErrorBox message={error} /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-2">User</th><th className="py-2 text-right">Balance</th><th className="py-2 text-right">Earned</th><th className="py-2 text-right">Streak</th><th /></tr></thead>
            <tbody>
              {data.wallets.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No wallets found.</td></tr>}
              {data.wallets.map((w: any) => (
                <tr key={w.appUserId} className="border-b last:border-0">
                  <td className="py-2"><div className="font-semibold">{w.appUser.userId}</div><div className="text-xs text-gray-500">{w.appUser.mobile ?? w.appUser.email ?? '—'}</div></td>
                  <td className="py-2 text-right font-bold">{w.balance.toLocaleString('en-IN')}</td>
                  <td className="py-2 text-right text-gray-600">{w.lifetimeEarned.toLocaleString('en-IN')}</td>
                  <td className="py-2 text-right text-gray-600">{w.currentStreak} (best {w.longestStreak})</td>
                  <td className="py-2 text-right"><Btn tone="ghost" small onClick={() => setOpen(w.appUserId)}>Open</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {open && <UserModal id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function UserModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, loading, reload } = useLoad<any>(`/api/dashboard/coins/users/${id}`);
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function adjust() {
    setBusy(true); setErr('');
    try {
      await api(`/api/dashboard/coins/users/${id}`, 'POST', { amount, reason });
      setAmount(0); setReason(''); reload();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={data ? `${data.wallet.appUser.userId} — ${data.wallet.balance} coins` : 'Wallet'} onClose={onClose} wide>
      {loading && !data ? <Loading /> : error ? <ErrorBox message={error} /> : (
        <>
          <div className="flex gap-2 mb-4">
            {data.reconciled ? <Pill tone="green">Ledger matches balance</Pill> : <Pill tone="red">Ledger sum {data.ledgerSum} ≠ balance {data.wallet.balance}</Pill>}
            <Pill>Streak {data.wallet.currentStreak}</Pill>
          </div>
          <div className="grid sm:grid-cols-[8rem_1fr_auto] gap-3 items-end mb-5 p-3 rounded-xl bg-gray-50 border">
            <Field label="Add / remove coins" hint="Use a minus to remove"><Num value={amount} min={-1000000} onChange={setAmount} /></Field>
            <Field label="Reason (required, saved in the audit log)"><Text value={reason} onChange={setReason} /></Field>
            <Btn onClick={adjust} busy={busy} disabled={!amount || reason.trim().length < 3}>Apply</Btn>
          </div>
          <ErrorBox message={err} />
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-2">When</th><th className="py-2">What</th><th className="py-2 text-right">Coins</th><th className="py-2 text-right">Balance</th></tr></thead>
              <tbody>
                {data.ledger.map((l: any) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-1.5 text-xs text-gray-500">{fmtDate(l.createdAt)}</td>
                    <td className="py-1.5">{l.type.replace(/_/g, ' ').toLowerCase()}{l.note && <span className="text-gray-400"> · {l.note}</span>}</td>
                    <td className={`py-1.5 text-right font-semibold ${l.amount < 0 ? 'text-red-600' : 'text-green-700'}`}>{l.amount > 0 ? '+' : ''}{l.amount}</td>
                    <td className="py-1.5 text-right text-gray-500">{l.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
