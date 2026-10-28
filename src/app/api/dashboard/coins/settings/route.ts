import { NextResponse } from 'next/server';
import { coinConfigSchema, getCoinConfig, saveCoinConfig, EVENT_TYPES } from '@/lib/coins/config';
import { auditCoins, bad, coinsAdmin, serverError, zodMessage } from '@/lib/coins/adminApi';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error } = await coinsAdmin(request);
  if (error) return error;
  try {
    return NextResponse.json({ config: await getCoinConfig(), eventTypes: EVENT_TYPES });
  } catch (e) {
    return serverError(e);
  }
}

export async function PUT(request: Request) {
  const { payload, error } = await coinsAdmin(request);
  if (error) return error;
  try {
    const parsed = coinConfigSchema.safeParse(await request.json());
    if (!parsed.success) return bad(zodMessage(parsed.error));
    const previous = await getCoinConfig();
    const config = await saveCoinConfig(parsed.data);
    await auditCoins(payload, 'COIN_SETTINGS_UPDATED', 'CoinSettings', 'coins.config', { previous, next: config });
    return NextResponse.json({ config });
  } catch (e) {
    return serverError(e);
  }
}
