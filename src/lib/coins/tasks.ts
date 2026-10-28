import { prisma } from '@/lib/prisma';
import { memo } from './memo';
import { getCoinConfig } from './config';
import {
  applyCoins, assertCoinsOn, CoinError, coinTransaction, dailyCapRemaining, ensureWallet, lockWallet,
} from './ledger';
import { periodKeyFor } from './time';
import { evaluateReferral } from './referral';

// A task is "do X n times in a day/week/ever, then tap Claim". Progress is
// counted from events — emitted by the server from real activity (a like, an
// upload …) or reported by the app for things only it can see (a share, an
// app open). Claiming re-checks everything on the server.

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  eventType: string;
  target: number;
  coins: number;
  frequency: string;
  startsAt: Date | null;
  endsAt: Date | null;
  sortOrder: number;
}

// Active tasks, cached. A task is only live inside its start/end window — the
// window is checked against `now` on every use, not baked into the cache.
function activeTasks(): Promise<TaskRow[]> {
  return memo('tasks', () =>
    prisma.coinTask.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, title: true, description: true, icon: true, eventType: true, target: true,
        coins: true, frequency: true, startsAt: true, endsAt: true, sortOrder: true,
      },
    }));
}

function inWindow(t: { startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  return (!t.startsAt || t.startsAt <= now) && (!t.endsAt || t.endsAt > now);
}

export async function liveTasks(): Promise<TaskRow[]> {
  const now = new Date();
  return (await activeTasks()).filter((t) => inWindow(t, now));
}

// Counts one (or n) occurrences of an event towards every live task that
// listens for it. Costs nothing when no task wants this event type.
export async function recordCoinEvent(appUserId: string, eventType: string, n = 1): Promise<void> {
  const cfg = await getCoinConfig();
  if (!cfg.enabled) return;

  if (cfg.features.tasks) {
    const now = new Date();
    const tasks = (await activeTasks()).filter((t) => t.eventType === eventType && inWindow(t, now));
    if (tasks.length) {
      await Promise.all(tasks.map((t) => {
        const periodKey = periodKeyFor(t.frequency, now);
        return prisma.coinTaskProgress.upsert({
          where: { appUserId_taskId_periodKey: { appUserId, taskId: t.id, periodKey } },
          create: { appUserId, taskId: t.id, periodKey, progress: n },
          update: { progress: { increment: n } },
        });
      }));
    }
  }
  if (cfg.features.referral && cfg.referral.qualify.type === 'EVENT' && cfg.referral.qualify.eventType === eventType) {
    await evaluateReferral(appUserId, { type: 'EVENT', eventType });
  }
}

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  eventType: string;
  target: number;
  progress: number;
  coins: number;
  frequency: string;
  status: 'IN_PROGRESS' | 'CLAIMABLE' | 'CLAIMED';
}

export async function tasksForUser(appUserId: string): Promise<TaskView[]> {
  const now = new Date();
  const tasks = await liveTasks();
  if (!tasks.length) return [];
  const keys = [...new Set(tasks.map((t) => periodKeyFor(t.frequency, now)))];
  const rows = await prisma.coinTaskProgress.findMany({
    where: { appUserId, periodKey: { in: keys }, taskId: { in: tasks.map((t) => t.id) } },
    select: { taskId: true, periodKey: true, progress: true, claimedAt: true },
  });
  const byTask = new Map(rows.map((r) => [`${r.taskId}|${r.periodKey}`, r]));
  return tasks.map((t) => {
    const r = byTask.get(`${t.id}|${periodKeyFor(t.frequency, now)}`);
    const progress = Math.min(r?.progress ?? 0, t.target);
    const status = r?.claimedAt ? 'CLAIMED' : progress >= t.target ? 'CLAIMABLE' : 'IN_PROGRESS';
    return {
      id: t.id, title: t.title, description: t.description, icon: t.icon, eventType: t.eventType,
      target: t.target, progress, coins: t.coins, frequency: t.frequency, status,
    };
  });
}

export async function claimTask(appUserId: string, taskId: string): Promise<{ coins: number; balance: number }> {
  await assertCoinsOn('tasks');
  await ensureWallet(appUserId);
  const dup = () => { throw new CoinError('ALREADY_CLAIMED', 'You already claimed this reward.', 409); };

  return coinTransaction(
    async (tx) => {
      await lockWallet(tx, appUserId);
      const task = await tx.coinTask.findUnique({ where: { id: taskId } });
      if (!task || !task.active || !inWindow(task)) throw new CoinError('NO_TASK', 'This task is no longer available.', 404);

      const periodKey = periodKeyFor(task.frequency);
      const row = await tx.coinTaskProgress.findUnique({
        where: { appUserId_taskId_periodKey: { appUserId, taskId, periodKey } },
      });
      if (row?.claimedAt) return dup();
      if (!row || row.progress < task.target) throw new CoinError('NOT_COMPLETE', 'Finish the task first.', 409);

      const room = await dailyCapRemaining(tx, appUserId);
      if (room <= 0) throw new CoinError('DAILY_CAP', "You've reached today's coin limit. Come back tomorrow!", 409);
      const coins = Math.min(task.coins, room);

      // The claim itself is the atomic step: only one request can flip claimedAt.
      const claimed = await tx.coinTaskProgress.updateMany({
        where: { id: row.id, claimedAt: null },
        data: { claimedAt: new Date() },
      });
      if (claimed.count !== 1) return dup();

      if (coins === 0) return { coins: 0, balance: (await tx.coinWallet.findUniqueOrThrow({ where: { appUserId } })).balance };
      const { balance } = await applyCoins(tx, {
        appUserId,
        amount: coins,
        type: 'TASK',
        key: `task:${appUserId}:${taskId}:${periodKey}`,
        sourceType: 'task',
        sourceId: taskId,
        note: task.title,
      });
      return { coins, balance };
    },
    async () => dup(),
  );
}
