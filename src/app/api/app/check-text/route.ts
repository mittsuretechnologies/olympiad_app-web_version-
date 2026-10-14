import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { containsAbuse, ABUSIVE_MESSAGES } from '@/lib/profanity';
import { getJwtSecret } from '@/lib/jwt-secret';

// POST /api/app/check-text  { field: 'caption' | 'hashtag', texts: string[] }
//   -> { ok: boolean, message? }
// Lets the Upload screen tell the user straight away that a caption or hashtag
// is not allowed, instead of only after the whole video has uploaded. The real
// enforcement stays on the routes that save the text.
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    verify(authHeader.split(' ')[1], getJwtSecret());
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const texts: unknown[] = Array.isArray(body?.texts) ? body.texts.slice(0, 40) : [];
  const bad = texts.some(t => typeof t === 'string' && containsAbuse(t.slice(0, 2500)));
  if (!bad) return NextResponse.json({ ok: true });
  return NextResponse.json({
    ok: false,
    message: body?.field === 'hashtag' ? ABUSIVE_MESSAGES.hashtag : ABUSIVE_MESSAGES.caption,
  });
}
