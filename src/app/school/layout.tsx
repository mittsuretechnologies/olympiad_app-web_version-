'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenExpired, clearSchoolSession } from '@/lib/session-token';
import AgreementGate from './AgreementGate';
import SchoolShell from './shell';

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [agreementPending, setAgreementPending] = useState(false);
  const [schoolToken, setSchoolToken] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('schoolToken');
    const raw = sessionStorage.getItem('schoolUser');
    // An expired token is treated the same as a missing one: without this the
    // page mounts fine and every API call 401s with no way back to /login.
    if (!token || !raw || isTokenExpired(token)) {
      clearSchoolSession();
      router.replace('/login');
      return;
    }
    try {
      setUser(JSON.parse(raw));
      setSchoolToken(token);
      // Check whether the school has accepted the onboarding agreement.
      // We kick off a lightweight fetch here; the gate shows a spinner while it resolves.
      fetch('/api/school/me/agreement', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then(json => { if (!json.accepted) setAgreementPending(true); })
        .catch(() => { /* network error — show the gate, it will retry */ setAgreementPending(true); })
        .finally(() => setReady(true));
    } catch {
      clearSchoolSession();
      router.replace('/login');
    }
  }, [router]);

  const handleLogout = () => {
    clearSchoolSession();
    router.replace('/login');
  };

  if (!ready) return null;

  // Show agreement gate before the portal if the school hasn't accepted yet.
  if (agreementPending && schoolToken) {
    return (
      <AgreementGate
        token={schoolToken}
        onAccepted={() => setAgreementPending(false)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <SchoolShell user={user} onLogout={handleLogout}>
      {children}
    </SchoolShell>
  );
}
