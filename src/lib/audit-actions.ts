// Catalogue of every action written to AuditLog (see recordAuditLog /
// recordAccessLog in lib/audit-log.ts). The Activity Log page and its API both
// read this list, so a new logged action only needs an entry here to get a
// label, a category filter and a colour. Client-safe: no server imports.

export type AuditCategory =
  | 'moderation'
  | 'copyright'
  | 'evaluation'
  | 'credentials'
  | 'dataAccess'
  | 'accounts'
  | 'schools'
  | 'admins';

export type AuditTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export interface AuditActionDef {
  label: string;
  category: AuditCategory;
  tone: AuditTone;
}

export const AUDIT_CATEGORIES: { key: AuditCategory; label: string; hint: string }[] = [
  { key: 'moderation',  label: 'Videos & Moderation',  hint: 'Approve, reject, delete, edit or download videos' },
  { key: 'copyright',   label: 'Copyright',            hint: 'Infringement notices and copyright decisions' },
  { key: 'evaluation',  label: 'Evaluation & Results', hint: 'Scores submitted, edited, published' },
  { key: 'credentials', label: 'Credentials',          hint: 'Passwords viewed, sent or reset' },
  { key: 'dataAccess',  label: 'Personal Data Access', hint: 'Who opened lists or details of people' },
  { key: 'accounts',    label: 'Accounts & Consent',   hint: 'Account deletion, consent, agreements' },
  { key: 'schools',     label: 'Schools',              hint: 'Attendance, exam date, school support, Olympiad IDs' },
  { key: 'admins',      label: 'Admin Accounts',       hint: 'Master Admins created, changed or removed' },
];

export const AUDIT_ACTIONS: Record<string, AuditActionDef> = {
  VIDEO_APPROVED:          { label: 'Video Approved',            category: 'moderation', tone: 'success' },
  VIDEO_REJECTED:          { label: 'Video Rejected',            category: 'moderation', tone: 'danger' },
  VIDEO_MOVED_TO_PENDING:  { label: 'Video Moved to Pending',    category: 'moderation', tone: 'warning' },
  VIDEO_RECATEGORIZED:     { label: 'Category Changed',          category: 'moderation', tone: 'info' },
  VIDEO_CAPTION_UPDATED:   { label: 'Caption Edited',            category: 'moderation', tone: 'info' },
  VIDEO_TAGS_UPDATED:      { label: 'Tags Edited',               category: 'moderation', tone: 'info' },
  VIDEO_DELETED:           { label: 'Video Deleted',             category: 'moderation', tone: 'danger' },
  VIDEO_DOWNLOADED:        { label: 'Video Downloaded',          category: 'moderation', tone: 'info' },
  // No longer written; kept so older entries still get a label.
  VISIBILITY_CHANGED:      { label: 'Visibility Changed',        category: 'moderation', tone: 'info' },
  REPORT_IGNORED:          { label: 'Report Ignored',            category: 'moderation', tone: 'neutral' },
  REPORT_VIDEO_REMOVED:    { label: 'Reported Video Removed',    category: 'moderation', tone: 'danger' },

  COPYRIGHT_VIDEO_DISABLED:   { label: 'Disabled for Copyright',     category: 'copyright', tone: 'danger' },
  COPYRIGHT_VIDEO_RESTORED:   { label: 'Restored after Review',      category: 'copyright', tone: 'success' },
  COPYRIGHT_VIDEO_REMOVED:    { label: 'Removed for Copyright',      category: 'copyright', tone: 'danger' },
  COPYRIGHT_REVIEW_EXTENDED:  { label: 'Copyright Review Extended',  category: 'copyright', tone: 'warning' },
  INFRINGEMENT_VIDEO_LINKED:  { label: 'Video Linked to Notice',     category: 'copyright', tone: 'info' },
  INFRINGEMENT_VIDEO_UNLINKED:{ label: 'Video Unlinked from Notice', category: 'copyright', tone: 'neutral' },

  EVALUATION_SUBMITTED:    { label: 'Evaluation Submitted',      category: 'evaluation', tone: 'warning' },
  EVALUATION_EDITED:       { label: 'Evaluation Edited',         category: 'evaluation', tone: 'warning' },
  EVALUATION_PUBLISHED:    { label: 'Result Published',          category: 'evaluation', tone: 'success' },
  EVALUATION_UNPUBLISHED:  { label: 'Result Unpublished',        category: 'evaluation', tone: 'neutral' },
  EVALUATOR_SCHOOLS_ASSIGNED: { label: 'Evaluator Schools Assigned', category: 'evaluation', tone: 'info' },

  CREDENTIALS_VIEWED:      { label: 'Passwords Viewed',          category: 'credentials', tone: 'warning' },
  CREDENTIALS_SENT:        { label: 'Credentials Sent',          category: 'credentials', tone: 'info' },
  CREDENTIALS_RESET:       { label: 'Password Reset',            category: 'credentials', tone: 'warning' },

  USER_DETAILS_VIEWED:     { label: 'Personal Details Viewed',   category: 'dataAccess', tone: 'neutral' },

  ACCOUNT_DELETED:                  { label: 'Account Deleted',              category: 'accounts', tone: 'danger' },
  ACCOUNT_DELETION_REJECTED:        { label: 'Deletion Request Rejected',    category: 'accounts', tone: 'neutral' },
  CONSENT_WITHDRAWN:                { label: 'Consent Withdrawn',            category: 'accounts', tone: 'danger' },
  COIN_SETTINGS_UPDATED:            { label: 'Coin Settings Changed',        category: 'accounts', tone: 'warning' },
  COIN_CONFIG_CHANGED:              { label: 'Coin Rules Changed',           category: 'accounts', tone: 'info' },
  COIN_ADJUSTED:                    { label: 'Coins Adjusted by Admin',      category: 'accounts', tone: 'warning' },
  COIN_REDEMPTION_HANDLED:          { label: 'Reward Redemption Handled',    category: 'accounts', tone: 'info' },
  COIN_REFERRAL_REVIEWED:           { label: 'Referral Reviewed',            category: 'accounts', tone: 'info' },
  EVALUATOR_TERMS_ACCEPTED: { label: 'Evaluator Terms Accepted', category: 'accounts', tone: 'success' },
  AGREEMENT_REACCEPTANCE_REQUESTED: { label: 'Agreement Re-acceptance Asked', category: 'accounts', tone: 'info' },
  GENERAL_SCHOOL_ACTIVATED:         { label: 'General School Activated',     category: 'accounts', tone: 'success' },
  GENERAL_SCHOOL_DEACTIVATED:       { label: 'General School Deactivated',   category: 'accounts', tone: 'danger' },

  ATTENDANCE_REOPENED:     { label: 'Attendance Reopened',       category: 'schools', tone: 'warning' },
  SCHOOL_EXAM_DATE_SET:    { label: 'Exam Date Set',             category: 'schools', tone: 'info' },
  OLYMPIAD_IDS_DELETED:    { label: 'Unused Olympiad IDs Deleted', category: 'schools', tone: 'danger' },
  SCHOOL_SUPPORT_REPLIED:  { label: 'School Support Reply',      category: 'schools', tone: 'info' },
  SCHOOL_SUPPORT_UPDATED:  { label: 'School Ticket Updated',     category: 'schools', tone: 'neutral' },

  MASTER_ADMIN_CREATED:     { label: 'Master Admin Created',     category: 'admins', tone: 'success' },
  MASTER_ADMIN_UPDATED:     { label: 'Master Admin Edited',      category: 'admins', tone: 'info' },
  MASTER_ADMIN_ACTIVATED:   { label: 'Master Admin Activated',   category: 'admins', tone: 'success' },
  MASTER_ADMIN_DEACTIVATED: { label: 'Master Admin Deactivated', category: 'admins', tone: 'danger' },
  MASTER_ADMIN_DELETED:     { label: 'Master Admin Deleted',     category: 'admins', tone: 'danger' },
};

export function auditActionDef(action: string): AuditActionDef {
  return AUDIT_ACTIONS[action] ?? {
    label: action.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    category: 'moderation',
    tone: 'neutral',
  };
}

export function actionsInCategory(category: AuditCategory): string[] {
  return Object.keys(AUDIT_ACTIONS).filter((a) => AUDIT_ACTIONS[a].category === category);
}

export const ACTOR_ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  MASTER_ADMIN: 'Master Admin',
  MODERATOR: 'Moderator',
  EVALUATOR: 'Evaluator',
  REVIEWER: 'Reviewer',
  SCHOOL: 'School',
  STUDENT: 'Student',
  UPLOADER: 'Uploader',
  VIEWER: 'Viewer',
};

// Lookup modes the Activity Log offers. Every query has to name one of these
// plus a date range, so the API never scans the whole table.
export type AuditLookupMode = 'staff' | 'student' | 'school' | 'video' | 'action';

// Longest period one report may cover.
export const AUDIT_MAX_RANGE_DAYS = 366;
export const AUDIT_PAGE_SIZE = 50;
