import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { getLiveTheme, invalidateLiveTheme, toPublicTheme } from '@/lib/appTheme';
import { createThemeSchema, checkWindow, zodMessage } from '@/lib/appThemeInput';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'appTheme');
  if (error) return error;
  try {
    const [rows, live] = await Promise.all([
      prisma.appTheme.findMany({
        orderBy: [{ startsAt: { sort: 'desc', nulls: 'first' } }, { createdAt: 'desc' }],
        include: { _count: { select: { banners: true } } },
      }),
      getLiveTheme(),
    ]);
    return NextResponse.json({
      liveId: live.theme?.id ?? null,
      themes: rows.map((r) => ({
        ...toPublicTheme(r),
        isActive: r.isActive,
        priority: r.priority,
        createdAt: r.createdAt.toISOString(),
        bannerCount: r._count.banners,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error } = await requireAdmin(request, 'appTheme');
  if (error) return error;
  try {
    const parsed = createThemeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: zodMessage(parsed.error) }, { status: 400 });
    const d = parsed.data;
    const windowError = checkWindow(d.startsAt, d.endsAt);
    if (windowError) return NextResponse.json({ message: windowError }, { status: 400 });

    const row = await prisma.appTheme.create({
      data: { name: d.name, isActive: d.isActive, startsAt: d.startsAt, endsAt: d.endsAt, priority: d.priority, config: d.config },
    });
    invalidateLiveTheme();
    return NextResponse.json({ ...toPublicTheme(row), isActive: row.isActive, priority: row.priority, bannerCount: 0 }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
