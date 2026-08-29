import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    const data: Record<string, any> = {};
    if ('desktopImage' in body) data.desktopImage = String(body.desktopImage).trim();
    if ('mobileImage' in body) data.mobileImage = body.mobileImage ? String(body.mobileImage).trim() : null;
    if ('alt' in body) data.alt = String(body.alt ?? '').trim();
    if ('title' in body) data.title = String(body.title ?? '').trim();
    if ('tag' in body) data.tag = String(body.tag ?? '').trim();
    if ('isActive' in body) data.isActive = Boolean(body.isActive);
    if ('order' in body) data.order = Number(body.order);

    const updated = await prisma.bannerSlide.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;
    await prisma.bannerSlide.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
