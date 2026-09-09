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
    if ('image' in body) data.image = String(body.image).trim();
    if ('alt' in body) data.alt = String(body.alt ?? '').trim();
    if ('title' in body) data.title = String(body.title ?? '').trim();
    if ('tag' in body) data.tag = String(body.tag ?? '').trim();
    if ('linkUrl' in body) data.linkUrl = String(body.linkUrl ?? '').trim();
    if ('isActive' in body) data.isActive = Boolean(body.isActive);
    if ('order' in body) data.order = Number(body.order);

    const updated = await prisma.appBannerSlide.update({ where: { id }, data });
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
    await prisma.appBannerSlide.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
