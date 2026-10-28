import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';
import { taskSchema, taskData } from '@/lib/coins/adminSchemas';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const parsed = taskSchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const previous = await prisma.coinTask.findUnique({ where: { id } });
    if (!previous) return bad('Task not found', 404);
    const task = await prisma.coinTask.update({ where: { id }, data: taskData(parsed.data) });
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinTask', id, { previous, next: task });
    return NextResponse.json({ task });
  } catch (e) {
    return serverError(e);
  }
}

// Deleting removes everyone's progress on it too; switch it off to keep history.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const { id } = await params;
    const previous = await prisma.coinTask.findUnique({ where: { id } });
    if (!previous) return bad('Task not found', 404);
    await prisma.coinTask.delete({ where: { id } });
    await auditCoins(payload, 'COIN_CONFIG_CHANGED', 'CoinTask', id, { previous });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
