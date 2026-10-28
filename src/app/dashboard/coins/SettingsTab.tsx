'use client';

import { useEffect, useState } from 'react';
import { Card, Btn, ErrorBox, Field, Loading, Num, Select, Toggle, api, inr, useLoad } from './ui';

const FEATURES: [string, string][] = [
  ['checkin', 'Daily check-in & streak'], ['tasks', 'Daily tasks'], ['referral', 'Refer & earn'],
  ['rewards', 'Rewards store'], ['games', 'Game coins'],
];
const EVENT_LABEL: Record<string, string> = {
  OPEN_APP: 'Open the app', WATCH_VIDEO: 'Watch a video', LIKE_VIDEO: 'Like a video', FOLLOW: 'Follow someone',
  UPLOAD_VIDEO: 'Upload a video', SHARE: 'Share', PLAY_GAME: 'Play a game', CUSTOM: 'Custom',
};

export default function SettingsTab() {
  const { data, error, loading } = useLoad<any>('/api/dashboard/coins/settings');
  const [c, setC] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (data) setC(structuredClone(data.config)); }, [data]);
  if (loading && !c) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!c) return null;

  const set = (path: string[], v: any) =>
    setC((prev: any) => {
      const next = structuredClone(prev);
      let o = next;
      path.slice(0, -1).forEach((k) => (o = o[k]));
      o[path[path.length - 1]] = v;
      return next;
    });

  async function save() {
    setSaving(true); setErr(''); setMsg('');
    try {
      const r = await api('/api/dashboard/coins/settings', 'PUT', c);
      setC(r.config);
      setMsg('Saved. The app picks this up within a minute.');
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  const q = c.referral.qualify;
  return (
    <div className="space-y-5">
      <Card title="Master switch" hint="Turn the whole coins system off instantly (the app hides it and every request is refused), or switch individual features.">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Toggle checked={c.enabled} onChange={(v) => set(['enabled'], v)} label="Coins enabled" />
          {FEATURES.map(([k, label]) => (
            <Toggle key={k} checked={c.features[k]} onChange={(v) => set(['features', k], v)} label={label} />
          ))}
        </div>
      </Card>

      <Card title="Coin value in rupees" hint="Used to show ₹ next to coins and to work out what you owe in unspent coins. Prices and earnings are in coins, so changing this never changes what users earn or what rewards cost.">
        <div className="max-w-xs">
          <Field label="₹ per 1 coin" hint={`100 coins = ${inr(100 * c.inrPerCoin)}`}>
            <Num value={c.inrPerCoin} min={0} max={1000} step={0.01} onChange={(v) => set(['inrPerCoin'], v)} />
          </Field>
        </div>
      </Card>

      <Card title="Daily streak" hint="The coins for each day live in the Streak tab. These rules decide when a streak breaks.">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Grace days" hint="Missed days allowed before the streak resets. 0 = miss a day, start over.">
            <Num value={c.streak.graceDays} max={7} onChange={(v) => set(['streak', 'graceDays'], v)} />
          </Field>
          <Field label="Coins for a day with no row" hint="Used if a ladder day is missing.">
            <Num value={c.streak.fallbackCoins} onChange={(v) => set(['streak', 'fallbackCoins'], v)} />
          </Field>
          <Field label="Cycle length when no ladder" hint="Days before the streak restarts.">
            <Num value={c.streak.fallbackCycle} min={1} max={365} onChange={(v) => set(['streak', 'fallbackCycle'], v)} />
          </Field>
        </div>
      </Card>

      <Card title="Earning limits" hint="A safety net against abuse and against config mistakes.">
        <div className="max-w-xs">
          <Field label="Max coins per user per day from tasks + games" hint="0 = no limit. Check-ins and referrals have their own rules.">
            <Num value={c.caps.dailyEarnCoins} onChange={(v) => set(['caps', 'dailyEarnCoins'], v)} />
          </Field>
        </div>
      </Card>

      <Card title="Referrals" hint="Coins are paid only once the new user qualifies, so fake accounts that never use the app earn nothing.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Coins for the inviter"><Num value={c.referral.referrerCoins} onChange={(v) => set(['referral', 'referrerCoins'], v)} /></Field>
          <Field label="Coins for the new user"><Num value={c.referral.refereeCoins} onChange={(v) => set(['referral', 'refereeCoins'], v)} /></Field>
          <Field label="Inviter max per day" hint="0 = no limit"><Num value={c.referral.maxPerReferrerPerDay} onChange={(v) => set(['referral', 'maxPerReferrerPerDay'], v)} /></Field>
          <Field label="Inviter max in total" hint="0 = no limit"><Num value={c.referral.maxPerReferrerTotal} onChange={(v) => set(['referral', 'maxPerReferrerTotal'], v)} /></Field>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <Field label="Pay out when the new user…">
            <Select value={q.type} onChange={(v) => set(['referral', 'qualify', 'type'], v)} options={[
              { value: 'SIGNUP', label: 'signs up (immediately)' },
              { value: 'CHECKIN_DAYS', label: 'collects daily coins for N days' },
              { value: 'EVENT', label: 'does a specific action once' },
            ]} />
          </Field>
          {q.type === 'CHECKIN_DAYS' && <Field label="Number of days"><Num value={q.days} min={1} onChange={(v) => set(['referral', 'qualify', 'days'], v)} /></Field>}
          {q.type === 'EVENT' && (
            <Field label="Action">
              <Select value={q.eventType} onChange={(v) => set(['referral', 'qualify', 'eventType'], v)}
                options={data.eventTypes.map((e: string) => ({ value: e, label: EVENT_LABEL[e] ?? e }))} />
            </Field>
          )}
        </div>
        <div className="mt-4">
          <Toggle checked={c.referral.blockSameDevice} onChange={(v) => set(['referral', 'blockSameDevice'], v)} label="Block a second referral from the same phone (turn off if families share one phone)" />
        </div>
        <div className="mt-5">
          <div className="text-xs font-semibold text-gray-700 mb-2">Milestone bonuses for the inviter</div>
          {c.referral.milestones.map((m: any, i: number) => (
            <div key={i} className="flex items-end gap-3 mb-2">
              <Field label="On the Nth referral"><Num value={m.count} min={1} onChange={(v) => set(['referral', 'milestones', String(i), 'count'], v)} /></Field>
              <Field label="Bonus coins"><Num value={m.coins} min={1} onChange={(v) => set(['referral', 'milestones', String(i), 'coins'], v)} /></Field>
              <Btn tone="danger" small onClick={() => set(['referral', 'milestones'], c.referral.milestones.filter((_: any, j: number) => j !== i))}>Remove</Btn>
            </div>
          ))}
          <Btn tone="ghost" small onClick={() => set(['referral', 'milestones'], [...c.referral.milestones, { count: 5, coins: 100 }])}>+ Add milestone</Btn>
        </div>
      </Card>

      <Card title="Rewards store">
        <div className="max-w-xs">
          <Field label="Minimum balance before anything can be redeemed" hint="0 = no minimum.">
            <Num value={c.redeem.minBalance} onChange={(v) => set(['redeem', 'minBalance'], v)} />
          </Field>
        </div>
      </Card>

      <Card title="Activity the app may report itself" hint="Likes, follows and uploads are counted by the server. Tick only what must come from the phone; anything ticked can in theory be faked, so keep these tasks small.">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {data.eventTypes.map((e: string) => (
            <Toggle key={e} label={EVENT_LABEL[e] ?? e} checked={c.clientEvents.includes(e)}
              onChange={(on) => set(['clientEvents'], on ? [...c.clientEvents, e] : c.clientEvents.filter((x: string) => x !== e))} />
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3 sticky bottom-3">
        <Btn onClick={save} busy={saving}>Save settings</Btn>
        {msg && <span className="text-sm text-green-700">{msg}</span>}
        <ErrorBox message={err} />
      </div>
    </div>
  );
}
