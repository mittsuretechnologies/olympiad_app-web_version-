'use client';

import { useState } from 'react';
import { Card, Btn, ErrorBox, Loading, Pill, Select, api, fmtDate, useLoad } from './ui';

const TONE: Record<string, 'amber' | 'green' | 'red'> = { PENDING: 'amber', REWARDED: 'green', REJECTED: 'red' };
const REASON: Record<string, string> = { SAME_DEVICE: 'Same phone as an earlier referral', ADMIN: 'Rejected by admin' };

export default function ReferralsTab() {
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useLoad<any>(`/api/dashboard/coins/referrals${status ? `?status=${status}` : ''}`);
  const [busyId, setBusyId] = useState('');

  async function act(id: string, action: 'APPROVE' | 'REJECT') {
    if (action === 'APPROVE' && !confirm('Pay the coins for this referral now?')) return;
    setBusyId(id);
    try { await api(`/api/dashboard/coins/referrals/${id}`, 'PATCH', { action }); reload(); } catch (e: any) { alert(e.message); } finally { setBusyId(''); }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  const counts = data.counts ?? {};
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Pill tone="green">{counts.REWARDED ?? 0} paid</Pill>
        <Pill tone="amber">{counts.PENDING ?? 0} waiting to qualify</Pill>
        <Pill tone="red">{counts.REJECTED ?? 0} blocked</Pill>
      </div>

      {data.leaderboard.length > 0 && (
        <Card title="Top inviters">
          <ol className="text-sm space-y-1">
            {data.leaderboard.map((l: any, i: number) => (
              <li key={i} className="flex justify-between max-w-sm"><span>{i + 1}. {l.userId}</span><b>{l.rewarded}</b></li>
            ))}
          </ol>
        </Card>
      )}

      <Card title="Referrals" hint="Blocked referrals (e.g. two siblings on one phone) can be approved by hand if they are genuine."
        right={<div className="w-44"><Select value={status} onChange={setStatus} options={[
          { value: '', label: 'All' }, { value: 'PENDING', label: 'Waiting to qualify' }, { value: 'REWARDED', label: 'Paid' }, { value: 'REJECTED', label: 'Blocked' },
        ]} /></div>}>
        <div className="divide-y">
          {data.referrals.length === 0 && <p className="py-6 text-center text-gray-400 text-sm">Nothing here.</p>}
          {data.referrals.map((r: any) => (
            <div key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[12rem]">
                <div className="text-sm"><b>{r.referrer.userId}</b> invited <b>{r.referee.userId}</b></div>
                <div className="text-xs text-gray-500">
                  {fmtDate(r.createdAt)}{r.rejectReason && ` · ${REASON[r.rejectReason] ?? r.rejectReason}`}
                  {r.status === 'REWARDED' && ` · paid ${r.referrerCoins ?? 0} + ${r.refereeCoins ?? 0} coins`}
                </div>
              </div>
              <Pill tone={TONE[r.status]}>{r.status.toLowerCase()}</Pill>
              {r.status !== 'REWARDED' && <Btn small busy={busyId === r.id} onClick={() => act(r.id, 'APPROVE')}>Approve & pay</Btn>}
              {r.status === 'PENDING' && <Btn small tone="danger" busy={busyId === r.id} onClick={() => act(r.id, 'REJECT')}>Reject</Btn>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
