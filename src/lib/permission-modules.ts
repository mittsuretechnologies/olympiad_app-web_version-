// Every module/sub-item key that Settings → Permission Control can grant. The
// sidebar (dashboard/layout.tsx) shows an item only when its key is granted,
// and API routes check the same keys with requireModule()/requireAdmin().
//
// `adminOnly` modules cover the sections that used to be SuperAdmin-only; only
// a Master Admin can be granted them — the Evaluator/Moderator APIs don't
// accept those roles, so offering them there would just produce 403s.

export type PermissionRole = 'MASTER_ADMIN' | 'EVALUATOR' | 'MODERATOR';

export interface PermissionSubItem { key: string; label: string; adminOnly?: boolean; }
export interface PermissionModule { key: string; label: string; subItems: PermissionSubItem[]; adminOnly?: boolean; }

export const PERMISSION_MODULES: PermissionModule[] = [
  { key: 'overview', label: 'Dashboard Overview', subItems: [], adminOnly: true },
  { key: 'schools', label: 'Schools', subItems: [{ key: 'schools.register', label: 'Register School' }, { key: 'schools.bulk', label: 'Bulk Upload' }, { key: 'schools.view', label: 'View / Edit Schools' }, { key: 'schools.attendance', label: 'Attendance Reports', adminOnly: true }] },
  { key: 'moderation', label: 'Moderation', subItems: [{ key: 'moderation.pending', label: 'Pending Approvals' }, { key: 'moderation.reported', label: 'Reported Videos' }, { key: 'moderation.moderators', label: 'Create Moderator' }] },
  { key: 'support', label: 'Support', subItems: [] },
  { key: 'uploaders', label: 'Uploaders', subItems: [{ key: 'uploaders.register', label: 'Register Uploader' }, { key: 'uploaders.view', label: 'View / Manage Uploaders' }] },
  { key: 'credentials', label: 'Credentials', subItems: [{ key: 'credentials.schools', label: 'School Credentials' }, { key: 'credentials.uploaders', label: 'Uploader Credentials' }, { key: 'credentials.students', label: 'Student Credentials' }, { key: 'credentials.reviewers', label: 'Reviewer Credentials' }, { key: 'credentials.masterReviewers', label: 'Master Reviewer Credentials' }, { key: 'credentials.evaluators', label: 'Evaluator Credentials' }] },
  { key: 'evaluator', label: 'Evaluator', subItems: [{ key: 'evaluator.manage', label: 'Manage Evaluators' }, { key: 'evaluator.content', label: 'Evaluate Content' }, { key: 'evaluator.history', label: 'Evaluation History' }] },
  { key: 'reports', label: 'Reports', subItems: [{ key: 'reports.students', label: 'Student Report' }, { key: 'reports.olympiad', label: 'Olympiad Completions' }, { key: 'reports.evaluation-progress', label: 'Evaluation Progress' }, { key: 'reports.schools', label: 'School Report' }, { key: 'reports.appusers', label: 'App Users' }, { key: 'reports.student-activity', label: 'Student Activity', adminOnly: true }, { key: 'reports.hashtag', label: 'Hashtag Campaign' }] },
  { key: 'result', label: 'Result', subItems: [], adminOnly: true },
  { key: 'banners', label: 'Banners', subItems: [], adminOnly: true },
  { key: 'appCarousel', label: 'App Carousel', subItems: [], adminOnly: true },
  { key: 'appTheme', label: 'App Theme & Festivals', subItems: [], adminOnly: true },
  { key: 'homeVideos', label: 'Learning & Parenting', subItems: [], adminOnly: true },
  { key: 'videoDownloads', label: 'Download Videos', subItems: [], adminOnly: true },
  { key: 'activityLog', label: 'Activity Log', subItems: [], adminOnly: true },
  { key: 'deletionRequests', label: 'Deletion Requests', subItems: [], adminOnly: true },
  { key: 'agreements', label: 'Agreements', subItems: [], adminOnly: true },
  { key: 'generalSchools', label: 'General Schools', subItems: [], adminOnly: true },
  { key: 'infringement', label: 'Report Infringement', subItems: [], adminOnly: true },
];

export function modulesForRole(role: PermissionRole): PermissionModule[] {
  if (role === 'MASTER_ADMIN') return PERMISSION_MODULES;
  return PERMISSION_MODULES
    .filter((m) => !m.adminOnly)
    .map((m) => ({ ...m, subItems: m.subItems.filter((s) => !s.adminOnly) }));
}

// Read-only grants live in the same allowedModules array as an extra
// "ro:<moduleKey>" entry next to the module's normal keys — no separate
// column. A read-only module (and every sub-item under it) can be viewed
// (GET) but every write (POST/PUT/PATCH/DELETE) is refused by requireModule().
export const READ_ONLY_PREFIX = 'ro:';

export function readOnlyMarker(moduleKey: string): string {
  return `${READ_ONLY_PREFIX}${moduleKey}`;
}

// "schools.view" is read-only when either "ro:schools.view" or its parent
// module's "ro:schools" is present.
export function isReadOnlyKey(allowedModules: string[], key: string): boolean {
  const parent = key.split('.')[0];
  return allowedModules.includes(readOnlyMarker(key)) || allowedModules.includes(readOnlyMarker(parent));
}
