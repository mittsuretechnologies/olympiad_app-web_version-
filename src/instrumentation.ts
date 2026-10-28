// Runs once when the Next.js server starts.
export async function register() {
  // Only the production Node server sends scheduled emails. A local `next dev`
  // shares the production database through the tunnel and must not send them.
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NODE_ENV !== 'production') return;

  const g = globalThis as { __dailyReportTimer?: NodeJS.Timeout };
  if (g.__dailyReportTimer) return;

  const { runDailyReportIfDue } = await import('@/lib/dailyVideoReport');
  // Checked every minute; runDailyReportIfDue sends at most once a day.
  g.__dailyReportTimer = setInterval(() => {
    runDailyReportIfDue().catch((e) => console.error('daily video report scheduler error:', e));
  }, 60_000);
}
