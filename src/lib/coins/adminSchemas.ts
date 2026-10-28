import { z } from 'zod';
import { EVENT_TYPES } from './config';

// Input shapes for the dashboard's coin endpoints (kept out of route files,
// which Next.js only lets export HTTP handlers).

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(200).nullish(),
  icon: z.string().trim().max(40).nullish(),
  eventType: z.enum(EVENT_TYPES),
  target: z.number().int().min(1).max(1000),
  coins: z.number().int().min(1).max(100000),
  frequency: z.enum(['DAILY', 'WEEKLY', 'ONCE']),
  active: z.boolean(),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  sortOrder: z.number().int().min(-1000).max(1000).default(0),
});

export function taskData(d: z.infer<typeof taskSchema>) {
  return {
    ...d,
    description: d.description || null,
    icon: d.icon || null,
    startsAt: d.startsAt ? new Date(d.startsAt) : null,
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
  };
}

export const rewardSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullish(),
  imageUrl: z.string().trim().max(500).nullish(),
  kind: z.enum(['COUPON', 'MANUAL']),
  costCoins: z.number().int().min(1).max(10_000_000),
  stock: z.number().int().min(0).max(1_000_000).nullish(),
  perUserLimit: z.number().int().min(0).max(1000).default(0),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  active: z.boolean(),
  sortOrder: z.number().int().min(-1000).max(1000).default(0),
  terms: z.string().trim().max(2000).nullish(),
  instructions: z.string().trim().max(1000).nullish(),
});

export function rewardData(d: z.infer<typeof rewardSchema>) {
  return {
    ...d,
    description: d.description || null,
    imageUrl: d.imageUrl || null,
    stock: d.kind === 'MANUAL' ? d.stock ?? null : null,
    startsAt: d.startsAt ? new Date(d.startsAt) : null,
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
    terms: d.terms || null,
    instructions: d.instructions || null,
  };
}
