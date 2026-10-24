// School notifications are switched off for now. To bring them back, remove the "// " prefix below.
// // Shared by the compose page (client) and the API, so it must not import prisma.
//
// export const NOTIFICATION_LIMITS = { title: 120, message: 1000 } as const;
//
// // Only paths inside the School Panel are accepted as a notification's link.
// export const isPanelLink = (v: unknown): v is string => typeof v === 'string' && /^\/school(\/[\w\-/]*)?$/.test(v);
//
export {};
