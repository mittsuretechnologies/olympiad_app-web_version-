// Copyright takedowns under the Infringement Policy (mittmee.com/infringement-policy):
// a disabled video stays down for 21 days from the date of the notice (6.1),
// and a notice is shown where it used to be (5.4).

export const COPYRIGHT_DISABLED = 'COPYRIGHT_DISABLED';

export const COPYRIGHT_REVIEW_DAYS = 21;

export const COPYRIGHT_REMOVED_NOTICE = 'This content has been removed following a copyright complaint.';

// Reminder email goes out once a review is due within this many days (or overdue).
export const COPYRIGHT_REMINDER_LEAD_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export function copyrightReviewDueAt(noticeDate: Date) {
  return new Date(noticeDate.getTime() + COPYRIGHT_REVIEW_DAYS * DAY_MS);
}

export function formatReviewDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export function reviewReminderCutoff(now = new Date()) {
  return new Date(now.getTime() + COPYRIGHT_REMINDER_LEAD_DAYS * DAY_MS);
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// Every video-id-shaped value in what the complainant pasted: a bare ID, a
// share link, or the ?videoId= the app's Report button puts on the form.
export function videoIdCandidates(videoLink: string): string[] {
  return [...new Set((videoLink.match(UUID_RE) || []).map((id) => id.toLowerCase()))];
}
