'use client';

import { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { RefreshCw, School, Smartphone } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import { SchoolRequests } from './SchoolRequests';
import { AppUserTickets } from './AppUserTickets';
import { COUNT_KEYS } from './ui';

// One Support inbox with a tab per requester. The two keep their own tables
// and APIs (school requests are threaded; app tickets are single-reply), only
// the screen is shared. ?tab=schools|app, and ?ticket=<id> deep-links a school
// request (used by the team's notification email).

type Tab = 'schools' | 'app';

export default function SupportPage() {
  // useSearchParams needs a Suspense boundary for the production build.
  return (
    <Suspense fallback={null}>
      <SupportInbox />
    </Suspense>
  );
}

function SupportInbox() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const [refreshing, setRefreshing] = useState(false);
  const tab: Tab = searchParams.get('tab') === 'app' && !searchParams.get('ticket') ? 'app' : 'schools';

  const { data: school } = useSWR<{ counts: Record<string, number> }>(COUNT_KEYS.schools, fetcher, { refreshInterval: 30_000 });
  const { data: app } = useSWR<{ counts: { OPEN: number } }>(COUNT_KEYS.app, fetcher, { refreshInterval: 30_000 });

  // "Needs the team": new or being worked on. Awaiting-school is the school's move.
  const tabs: { key: Tab; label: string; icon: typeof School; count: number }[] = [
    { key: 'schools', label: 'Schools', icon: School, count: (school?.counts.OPEN ?? 0) + (school?.counts.IN_PROGRESS ?? 0) },
    { key: 'app', label: 'App users', icon: Smartphone, count: app?.counts.OPEN ?? 0 },
  ];

  const refresh = async () => {
    setRefreshing(true);
    try {
      await mutate(key => typeof key === 'string' && (key.startsWith('/api/dashboard/school-support') || key.startsWith('/api/dashboard/support-tickets')));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Support</h1>
          <p className="mt-1 text-sm text-gray-500">Help requests from schools and app users, in one place.</p>
        </div>
        <button type="button" onClick={refresh} disabled={refreshing}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="space-y-4">
        <nav className="flex gap-6 border-b border-gray-200" aria-label="Support inboxes">
          {tabs.map(({ key, label, icon: Icon, count }) => {
            const active = tab === key;
            return (
              <button key={key} type="button" aria-current={active ? 'page' : undefined}
                onClick={() => router.replace(`${pathname}?tab=${key}`)}
                className={`-mb-px inline-flex items-center gap-2 border-b-2 pb-2.5 pt-1 text-sm font-medium transition-colors ${
                  active ? 'border-[#004f9f] text-[#004f9f]' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}>
                <Icon size={15} /> {label}
                {count > 0 && (
                  <span title={`${count} open`}
                    className={`min-w-[20px] rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 tabular-nums ${
                      active ? 'bg-[#004f9f] text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {tab === 'schools' ? <SchoolRequests /> : <AppUserTickets />}
      </div>
    </div>
  );
}
