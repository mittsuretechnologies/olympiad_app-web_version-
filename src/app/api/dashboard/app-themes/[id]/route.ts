import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { invalidateLiveTheme, toPublicTheme } from '@/lib/appTheme';
import { updateThemeSchema, checkWindow, zodMessage } from '@/lib/appThemeInput';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request, 'appTheme');
  if (error) return error;
  try {
    const { id } = await params;
    const parsed = updateThemeSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ message: zodMessage(parsed.error) }, { status: 400 });
    const d = parsed.data;

    const existing = await prisma.appTheme.findUnique({ where: { id }, select: { startsAt: true, endsAt: true } });
    if (!existing) return NextResponse.json({ message: 'Theme not found' }, { status: 404 });
    const windowError = checkWindow(
      d.startsAt !== undefined ? d.startsAt : existing.startsAt,
      d.endsAt !== undefined ? d.endsAt : existing.endsAt,
    );
    if (windowError) return NextResponse.json({ message: windowError }, { status: 400 });

    const row = await prisma.appTheme.update({
      where: { id },
      data: d,
      include: { _count: { select: { banners: true } } },
    });
    invalidateLiveTheme();
    return NextResponse.json({ ...toPublicTheme(row), isActive: row.isActive, priority: row.priority, bannerCount: row._count.banners });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// The theme's festival slides are hidden, not deleted: the FK would set their
// themeId to null, which would otherwise turn "Diwali only" art into an
// all-year slide. They stay in App Carousel for reuse.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin(request, 'appTheme');
  if (error) return error;
  try {
    const { id } = await params;
    await prisma.$transaction([
      prisma.appBannerSlide.updateMany({ where: { themeId: id }, data: { isActive: false, themeId: null } }),
      prisma.appTheme.delete({ where: { id } }),
    ]);
    invalidateLiveTheme();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
