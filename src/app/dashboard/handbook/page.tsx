'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Lock, RotateCw } from 'lucide-react';
import HandbookBook, { MODERATOR_LABELS, type BookLabels } from '@/components/handbook/HandbookBook';
import type { Handbook } from '@/lib/handbook/moderator-handbook';

// Staff handbook — always available from the sidebar: the Moderator Handbook
// to the MODERATOR role, the Evaluator's Handbook to the EVALUATOR role. The
// text comes from /api/staff/handbook, which picks the book by the token's role.

type StaffRole = 'MODERATOR' | 'EVALUATOR';

const EVALUATOR_LABELS: BookLabels = {
  ...MODERATOR_LABELS,
  coverTitle: ['Evaluator’s', 'Handbook'],
  coverTag: 'CONFIDENTIAL',
  runningTitle: 'Evaluator’s Handbook',
};

const COPY: Record<StaffRole, { title: string; note: string; labels: BookLabels }> = {
  MODERATOR: { title: 'Moderator Handbook', note: 'Internal · For moderators only', labels: MODERATOR_LABELS },
  EVALUATOR: { title: 'Evaluator’s Handbook', note: 'Confidential · For evaluators only', labels: EVALUATOR_LABELS },
};

/** The staff token this session holds. The dashboard treats a session with the admin token as SuperAdmin. */
function staffSession(): { role: StaffRole; token: string } | null {
  if (sessionStorage.getItem('token')) return null;
  const evaluatorToken = sessionStorage.getItem('evaluatorToken');
  if (evaluatorToken) return { role: 'EVALUATOR', token: evaluatorToken };
  const moderatorToken = sessionStorage.getItem('moderatorToken');
  if (moderatorToken) return { role: 'MODERATOR', token: moderatorToken };
  return null;
}

export default function HandbookPage() {
  const [state, setState] = useState<'loading' | 'forbidden' | 'error' | 'ready'>('loading');
  const [data, setData] = useState<Handbook | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const session = staffSession();
    if (!session) { setState('forbidden'); return; }
    setRole(session.role);
    setState('loading');
    fetch('/api/staff/handbook', { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r => {
        if (r.status === 401 || r.status === 403) { setState('forbidden'); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((json: Handbook | null) => { if (json) { setData(json); setState('ready'); } })
      .catch(() => setState('error'));
  }, [attempt]);

  const copy = COPY[role ?? 'MODERATOR'];

  return (
    <div>
      {/* Compact header: the book needs the vertical space. */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="text-2xl font-medium text-[#004f9f]">{role ? copy.title : 'Handbook'}</h1>
        {role && (
          <p className="text-xs text-gray-500">
            {copy.note}{data ? ` · Version ${data.version}` : ''}
          </p>
        )}
      </div>

      {state === 'loading' && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-[#052E5C]" size={26} aria-label="Loading" />
        </div>
      )}

      {state === 'forbidden' && (
        <div className="max-w-md mx-auto my-16 text-center">
          <Lock className="mx-auto text-[#6B7280]" size={26} />
          <p className="mt-3 text-[15px] font-semibold text-[#052E5C]">The handbook is available to moderators and evaluators only</p>
          <p className="mt-1 text-[13px] text-[#6B7280]">Sign in with a moderator or evaluator account to read it.</p>
        </div>
      )}

      {state === 'error' && (
        <div className="max-w-md mx-auto my-16 text-center">
          <AlertCircle className="mx-auto text-[#B91C1C]" size={26} />
          <p className="mt-3 text-[15px] font-semibold text-[#052E5C]">Couldn&apos;t load the handbook</p>
          <button
            onClick={() => setAttempt(a => a + 1)}
            className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#052E5C] text-white text-[13px] font-medium cursor-pointer"
          >
            <RotateCw size={14} /> Retry
          </button>
        </div>
      )}

      {state === 'ready' && data && <HandbookBook handbook={data} labels={copy.labels} />}
    </div>
  );
}
