// Shared by the compose page (client) and the API, so it must not import prisma.

export const NOTIFICATION_LIMITS = { title: 120, message: 1000 } as const;

// Only paths inside the School Panel are accepted as a notification's link.
export const isPanelLink = (v: unknown): v is string => typeof v === 'string' && /^\/school(\/[\w\-/]*)?$/.test(v);

// Where a notification can take the school when clicked (compose page dropdown).
export const PANEL_LINKS: { value: string; label: string }[] = [
  { value: '', label: 'No link' },
  { value: '/school/passports', label: 'Student Passports' },
  { value: '/school/olympiad-ids', label: 'Olympiad IDs' },
  { value: '/school/registered-students', label: 'My Students' },
  { value: '/school/student-requests', label: 'Student Requests' },
  { value: '/school/reports', label: 'Student Report' },
  { value: '/school/student-videos', label: 'Student Videos' },
  { value: '/school/upload-video', label: 'Upload Video' },
  { value: '/school/upload-status', label: 'Upload Status' },
  { value: '/school/profile', label: 'School Profile' },
  { value: '/school/support', label: 'Help & Support' },
];
