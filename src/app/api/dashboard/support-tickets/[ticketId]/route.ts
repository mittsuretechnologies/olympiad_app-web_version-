import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function requireSuperAdmin(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
    return payload?.role === 'SUPERADMIN' ? payload : null;
  } catch {
    return null;
  }
}

// PATCH /api/dashboard/support-tickets/:ticketId — body: { status: 'OPEN' | 'RESOLVED' }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const admin = requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const { ticketId } = await params;

  try {
    const { status } = await request.json();
    if (status !== 'OPEN' && status !== 'RESOLVED') {
      return NextResponse.json({ message: 'status must be "OPEN" or "RESOLVED"' }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) return NextResponse.json({ message: 'Ticket not found' }, { status: 404 });

    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH dashboard/support-tickets/:ticketId failed:', error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
