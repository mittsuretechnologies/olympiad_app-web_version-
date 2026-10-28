'use client';

import { useState } from 'react';
import { Coins } from 'lucide-react';
import OverviewTab from './OverviewTab';
import SettingsTab from './SettingsTab';
import StreakTab from './StreakTab';
import TasksTab from './TasksTab';
import RewardsTab from './RewardsTab';
import RedemptionsTab from './RedemptionsTab';
import ReferralsTab from './ReferralsTab';
import GamesTab from './GamesTab';
import UsersTab from './UsersTab';

// Dashboard → Coins & Rewards. Everything the mobile app shows about coins is
// configured here and takes effect within about a minute — no app update.

const TABS = [
  { key: 'overview', label: 'Overview', Comp: OverviewTab },
  { key: 'settings', label: 'Settings', Comp: SettingsTab },
  { key: 'streak', label: 'Streak', Comp: StreakTab },
  { key: 'tasks', label: 'Tasks', Comp: TasksTab },
  { key: 'referrals', label: 'Referrals', Comp: ReferralsTab },
  { key: 'rewards', label: 'Rewards', Comp: RewardsTab },
  { key: 'redemptions', label: 'Redemptions', Comp: RedemptionsTab },
  { key: 'games', label: 'Games', Comp: GamesTab },
  { key: 'users', label: 'Wallets', Comp: UsersTab },
] as const;

export default function CoinsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('overview');
  const Active = TABS.find((t) => t.key === tab)!.Comp;
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><Coins size={22} /></div>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Coins &amp; Rewards</h1>
          <p className="text-xs text-gray-500">Daily streaks, tasks, referrals, games and the rewards store — all editable here.</p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 mb-5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-[#004f9f] text-[#004f9f]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}
