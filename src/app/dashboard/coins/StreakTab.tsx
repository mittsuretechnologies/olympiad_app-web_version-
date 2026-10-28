'use client';

import { useEffect, useState } from 'react';
import { Card, Btn, ErrorBox, Loading, Num, Text, Toggle, api, inr, useLoad } from './ui';

interface Day { coins: number; isBonus: boolean; label: string }

export default function StreakTab() {
  const { data, error, loading } = useLoad<any>('/api/dashboard/coins/streak');
  const rate = useLoad<any>('/api/dashboard/coins/settings').data?.config?.inrPerCoin ?? 0;
  const [days, setDays] = useState<Day[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (data) setDays(data.days.map((d: any) => ({ coins: d.coins, isBonus: d.isBonus, label: d.label ?? '' })));
  }, [data]);
  if (loading && !days) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!days) return null;

  const patch = (i: number, p: Partial<Day>) => setDays(days.map((d, j) => (j === i ? { ...d, ...p } : d)));
  const total = days.reduce((s, d) => s + d.coins, 0);

  async function save() {
    setSaving(true); setErr(''); setMsg('');
    try {
      await api('/api/dashboard/coins/streak', 'PUT', { days: days!.map((d) => ({ ...d, label: d.label.trim() || null })) });
      setMsg('Saved.');
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <Card
        title="Streak ladder"
        hint="Row N is what a user gets on day N of an unbroken streak. After the last day the ladder starts again from day 1. A user who misses a day (beyond the grace days in Settings) restarts at day 1. The number of rows is the cycle length."
        right={<div className="text-right text-xs text-gray-500">One full cycle<br /><b className="text-gray-900 text-sm">{total} coins</b>{rate ? ` (${inr(total * rate)})` : ''}</div>}
      >
        <div className="space-y-2">
          {days.map((d, i) => (
            <div key={i} className="grid grid-cols-[3.5rem_7rem_1fr_auto_auto] items-end gap-3">
              <div className="pb-2 text-sm font-bold text-gray-700">Day {i + 1}</div>
              <Num value={d.coins} onChange={(v) => patch(i, { coins: v })} />
              <Text value={d.label} onChange={(v) => patch(i, { label: v })} placeholder={d.isBonus ? 'e.g. Weekly bonus!' : 'Label (optional)'} />
              <div className="pb-2"><Toggle checked={d.isBonus} onChange={(v) => patch(i, { isBonus: v })} label="Bonus" /></div>
              <Btn tone="danger" small onClick={() => setDays(days.filter((_, j) => j !== i))}>Remove</Btn>
            </div>
          ))}
          {days.length === 0 && (
            <p className="text-sm text-gray-500">No days set. Every check-in gives the fallback coins from Settings, on the fallback cycle length.</p>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Btn tone="ghost" small onClick={() => setDays([...days, { coins: days[days.length - 1]?.coins ?? 1, isBonus: false, label: '' }])}>+ Add day</Btn>
        </div>
      </Card>
      <div className="flex items-center gap-3">
        <Btn onClick={save} busy={saving}>Save ladder</Btn>
        {msg && <span className="text-sm text-green-700">{msg}</span>}
        <ErrorBox message={err} />
      </div>
    </div>
  );
}
