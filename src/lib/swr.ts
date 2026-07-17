// Shared SWR fetcher + sensible defaults for dashboard data fetching.
// SWR caches by key (the URL), dedupes concurrent/duplicate requests, and
// revalidates in the background so repeat visits render instantly.

// Must stay in sync with the roles the dashboard layout admits — it lets
// moderators in, so omitting moderatorToken here sends no auth header at all
// and the request 401s with no clue why.
export const DASHBOARD_TOKEN_KEYS = ['token', 'reviewerToken', 'evaluatorToken', 'moderatorToken'] as const;

export function clearDashboardSession() {
  for (const key of [
    'token', 'adminUser',
    'reviewerToken', 'reviewerData',
    'evaluatorToken', 'evaluatorData',
    'moderatorToken', 'moderatorData',
  ]) {
    sessionStorage.removeItem(key);
  }
}

export function getDashboardToken(): string | null {
  if (typeof window === 'undefined') return null;
  for (const key of DASHBOARD_TOKEN_KEYS) {
    const value = sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

// A 401 means the session is gone or expired. Leaving the caller to render a
// generic error strands the user on a page where every request fails, so send
// them back to /login the same way the layout guard would on a fresh mount.
function handleUnauthorized() {
  if (typeof window === 'undefined') return;
  clearDashboardSession();
  window.location.href = '/login';
}

// Use for every dashboard call to a requireRole()-guarded route. Attaching the
// token by hand is what got missed across these pages, producing bare 401s.
export async function authFetch(url: string, init: RequestInit = {}) {
  const token = getDashboardToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) handleUnauthorized();
  return res;
}

export const fetcher = async (url: string) => {
  const res = await authFetch(url);
  if (!res.ok) {
    const err: any = new Error(res.status === 401 ? 'Your session expired. Please sign in again.' : 'Request failed');
    err.status = res.status;
    throw err;
  }
  return res.json();
};

// Default options used by useSWR calls across the dashboard.
export const swrConfig = {
  fetcher,
  revalidateOnFocus: false, // don't refetch every time the tab regains focus
  dedupingInterval: 5000, // collapse identical requests fired within 5s
  keepPreviousData: true, // show cached data instantly while revalidating
};
