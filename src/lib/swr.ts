// Shared SWR fetcher + sensible defaults for dashboard data fetching.
// SWR caches by key (the URL), dedupes concurrent/duplicate requests, and
// revalidates in the background so repeat visits render instantly.

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err: any = new Error('Request failed');
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
