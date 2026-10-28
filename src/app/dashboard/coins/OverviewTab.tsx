'use client';

import { Card, ErrorBox, Loading, Pill, inr, useLoad } from './ui';

const TYPE_LABEL: Record<string, string> = {
  CHECKIN: 'Daily check-in', TASK: 'Tasks', GAME: 'Games', REFERRAL_REFERRER: 'Referral (inviter)',
  REFERRAL_REFEREE: 'Referral (new user)', REFERRAL_MILESTONE: 'Referral milestones', REDEEM: 'Redeemed',
  REFUND: 'Refunds', ADMIN_ADJUST: 'Manual adjustments',
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-500">{label}</div>
      <div className="text-2xl font-extrabold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function OverviewTab() {
  const { data, error, loading } = useLoad<any>('/api/dashboard/coins/stats');
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  const n = (x: number) => x.toLocaleString('en-IN');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Coins in circulation" value={n(data.outstandingCoins)} sub={`across ${n(data.wallets)} wallets`} />
        <Stat label="Your liability" value={inr(data.liabilityInr)} sub={`at ₹${data.inrPerCoin} per coin`} />
        <Stat label="Earned, all time" value={n(data.lifetimeEarned)} />
        <Stat label="Spent, all time" value={n(data.lifetimeSpent)} />
      </div>
      {(data.pendingRedemptions > 0 || data.pendingReferrals > 0) && (
        <div className="flex gap-2 flex-wrap">
          {data.pendingRedemptions > 0 && <Pill tone="amber">{data.pendingRedemptions} reward(s) waiting to be fulfilled</Pill>}
          {data.pendingReferrals > 0 && <Pill tone="blue">{data.pendingReferrals} referral(s) not yet qualified</Pill>}
        </div>
      )}
      <Card title="Last 30 days" hint="Coins created and spent, by source. Positive = given to users, negative = taken (redemptions, deductions).">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-2">Source</th><th className="py-2 text-right">Entries</th><th className="py-2 text-right">Coins</th><th className="py-2 text-right">Value</th></tr></thead>
          <tbody>
            {data.last30Days.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400">Nothing yet.</td></tr>}
            {data.last30Days.map((r: any) => (
              <tr key={r.type} className="border-b last:border-0">
                <td className="py-2">{TYPE_LABEL[r.type] ?? r.type}</td>
                <td className="py-2 text-right">{n(r.count)}</td>
                <td className={`py-2 text-right font-semibold ${r.coins < 0 ? 'text-red-600' : 'text-green-700'}`}>{r.coins > 0 ? '+' : ''}{n(r.coins)}</td>
                <td className="py-2 text-right text-gray-500">{inr(Math.abs(r.coins) * data.inrPerCoin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
