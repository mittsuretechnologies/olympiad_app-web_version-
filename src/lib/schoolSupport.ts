// School Panel Help & Support — shared constants and helpers used by both the
// school-side and dashboard-side routes and pages.

export const SUPPORT_CATEGORIES = [
  { value: 'LOGIN_ACCOUNT',        label: 'Login / Account' },
  { value: 'DETAIL_UPDATION',      label: 'Detail Updation (School / Student details)' },
  { value: 'OLYMPIAD_IDS',         label: 'Olympiad IDs & Credentials' },
  { value: 'STUDENT_REGISTRATION', label: 'Student Registration' },
  { value: 'VIDEO_UPLOAD',         label: 'Video Upload / Visibility' },
  { value: 'PAPER_DISPATCH',       label: 'Question Paper / Answer Sheets' },
  { value: 'EXAM_ATTENDANCE',      label: 'Exam & Attendance' },
  { value: 'RESULTS_REPORTS',      label: 'Results & Reports' },
  { value: 'AGREEMENT_BILLING',    label: 'Agreement / Billing' },
  { value: 'OTHER',                label: 'Other' },
] as const;

export type SupportCategory = typeof SUPPORT_CATEGORIES[number]['value'];

export const SUPPORT_STATUSES = ['OPEN', 'IN_PROGRESS', 'AWAITING_SCHOOL', 'RESOLVED'] as const;
export type SupportStatus = typeof SUPPORT_STATUSES[number];

/** Wording is from the school's point of view, since they read it most. */
export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  OPEN:            'Open',
  IN_PROGRESS:     'In progress',
  AWAITING_SCHOOL: 'Awaiting your reply',
  RESOLVED:        'Resolved',
};

/** Same statuses as the support team sees them on the dashboard. */
export const SUPPORT_STATUS_LABEL_TEAM: Record<SupportStatus, string> = {
  OPEN:            'Open',
  IN_PROGRESS:     'In progress',
  AWAITING_SCHOOL: 'Awaiting school',
  RESOLVED:        'Resolved',
};

export const SUPPORT_PRIORITIES = ['NORMAL', 'URGENT'] as const;
export type SupportPriority = typeof SUPPORT_PRIORITIES[number];

export const SUPPORT_LIMITS = {
  subject: 150,
  body: 5000,
  attachmentsPerMessage: 3,
  attachmentBytes: 5 * 1024 * 1024,
  /** Open (unresolved) requests a school may have at once — stops a stuck
   *  form or a double-click from flooding the queue. */
  openTicketsPerSchool: 10,
} as const;

export interface SupportAttachment {
  url: string;
  name: string;
  type: 'image' | 'pdf';
}

export const ticketRef = (ticketNo: number) => `HS-${ticketNo}`;

export const categoryLabel = (value: string) =>
  SUPPORT_CATEGORIES.find(c => c.value === value)?.label ?? value;

export const isSupportCategory = (v: unknown): v is SupportCategory =>
  typeof v === 'string' && SUPPORT_CATEGORIES.some(c => c.value === v);

export const isSupportStatus = (v: unknown): v is SupportStatus =>
  typeof v === 'string' && (SUPPORT_STATUSES as readonly string[]).includes(v);

/**
 * Validates attachments sent with a message. Only URLs our own upload route
 * returned are accepted (same S3 bucket / server prefix), so a message can't
 * be used to plant arbitrary links in the support thread.
 */
export function cleanAttachments(input: unknown): SupportAttachment[] | null {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > SUPPORT_LIMITS.attachmentsPerMessage) return null;
  const out: SupportAttachment[] = [];
  for (const a of input) {
    if (!a || typeof a !== 'object') return null;
    const { url, name, type } = a as Record<string, unknown>;
    if (typeof url !== 'string' || !url.includes('/school-support/')) return null;
    if (type !== 'image' && type !== 'pdf') return null;
    out.push({ url, name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : 'attachment', type });
  }
  return out;
}
