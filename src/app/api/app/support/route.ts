import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

function getAppUserFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'APP_USER') return null;
    return decoded;
  } catch {
    return null;
  }
}

// POST /api/app/support — submit a Help & Support query
export async function POST(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { category, message, screenshotUrls } = await request.json();

    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    const urls = Array.isArray(screenshotUrls) ? screenshotUrls.filter(Boolean).slice(0, 3) : [];

    if (!trimmedMessage && urls.length === 0) {
      return NextResponse.json({ error: 'Please describe your issue or attach a screenshot.' }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId:         appUser.id,
        category:       typeof category === 'string' && category.trim() ? category.trim() : null,
        message:        trimmedMessage || '(No description provided — see attached screenshots)',
        screenshotUrls: urls.length > 0 ? urls.join(',') : null,
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error: any) {
    console.error('Support ticket submission error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/app/support — list the logged-in user's own tickets (for future "my queries" view)
export async function GET(request: Request) {
  const appUser = getAppUserFromToken(request);
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: appUser.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(tickets);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
