import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = (body.name ?? '').toString().trim();
    const email = (body.email ?? '').toString().trim();
    const phone = (body.phone ?? '').toString().trim();
    const status = (body.status ?? 'ACTIVE').toString();

    if (!name) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }

    const updated = await prisma.uploader.update({
      where: { id },
      data: {
        name,
        email: email || null,
        phone: phone || null,
        status,
      },
    });
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PUT /api/uploaders/[id] failed:', error);
    if (error?.code === 'P2025') {
      return NextResponse.json({ message: 'Uploader not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to update uploader' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.uploader.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/uploaders/[id] failed:', error);
    if (error?.code === 'P2025') {
      return NextResponse.json({ message: 'Uploader not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Failed to delete uploader' }, { status: 500 });
  }
}
