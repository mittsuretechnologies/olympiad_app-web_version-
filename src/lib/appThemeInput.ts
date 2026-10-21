import { z } from 'zod';
import { appThemeConfigSchema } from '@/lib/appThemeConfig';

// Request body for creating/updating an AppTheme from the dashboard. Shared
// by POST /api/dashboard/app-themes and PATCH /api/dashboard/app-themes/[id].

const dateOrNull = z
  .union([z.string().datetime({ offset: true }), z.null()])
  .transform((v) => (v ? new Date(v) : null));

const fields = {
  name: z.string().trim().min(1, 'Name is required').max(60),
  isActive: z.boolean(),
  startsAt: dateOrNull,
  endsAt: dateOrNull,
  priority: z.number().int().min(-100).max(100),
  config: appThemeConfigSchema,
};

export const createThemeSchema = z.object({
  ...fields,
  isActive: fields.isActive.default(false),
  startsAt: fields.startsAt.default(null),
  endsAt: fields.endsAt.default(null),
  priority: fields.priority.default(0),
  config: fields.config.default({}),
});

export const updateThemeSchema = z.object(fields).partial();

export function checkWindow(startsAt: Date | null | undefined, endsAt: Date | null | undefined): string | null {
  if (startsAt && endsAt && endsAt <= startsAt) return 'End time must be after the start time';
  return null;
}

// First zod issue as one readable line, e.g. "config.colors.accent: Colours must be hex…".
export function zodMessage(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.length ? `${i.path.join('.')}: ` : ''}${i.message}` : 'Invalid request';
}
