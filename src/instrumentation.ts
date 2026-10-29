// Runs once when the Next.js server starts.
export async function register() {
  // The positive runtime check matters: Next compiles this file for the edge
  // runtime too, and only drops the Node-only import (nodemailer) from that
  // build when it sits inside an `=== 'nodejs'` branch.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only the production Node server sends scheduled emails. A local `next dev`
    // shares the production database through the tunnel and must not send them.
    if (process.env.NODE_ENV !== 'production') return;

    const g = globalThis as { __dailyReportTimer?: NodeJS.Timeout };
    if (g.__dailyReportTimer) return;

    const { runDailyReportIfDue } = await import('@/lib/dailyVideoReport');
    // Checked every minute; runDailyReportIfDue sends at most once a day.
    g.__dailyReportTimer = setInterval(() => {
      runDailyReportIfDue().catch((e) => console.error('daily video report scheduler error:', e));
    }, 60_000);
  }
}
