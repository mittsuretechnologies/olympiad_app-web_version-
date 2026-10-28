import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { taskSchema, taskData } from '@/lib/coins/adminSchemas';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const tasks = await prisma.coinTask.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    return NextResponse.json({ tasks });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(request: Request) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const parsed = taskSchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const task = await prisma.coinTask.create({ data: taskData(parsed.data) });
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinTask', task.id, { next: task });
    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
