import { NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/jwt-secret';
import { stateCompetitionFor } from '@/lib/stateCompetition';

export const dynamic = 'force-dynamic';

function appUserFromToken(request: Request) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const decoded = verify(auth.split(' ')[1], getJwtSecret()) as any;
    return decoded.role === 'APP_USER' ? decoded : null;
  } catch { return null; }
}

// GET /api/app/state-competition — the signed-in student's State Level status.
//   { eligible: false }                          not selected for the State Level
//   { eligible: true, forwardedAt, category,     selected; `category` is the State Level
//     canUpload, video }                         category to upload into while it is open
//                                                (null when closed), `canUpload` false once
//                                                their one video is in, `video` that video.
// The app shows the State Level category only when eligible, and uploads into
// it through the usual POST /api/app/videos with that category and an option.
export async function GET(request: Request) {
  const user = appUserFromToken(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const me = await prisma.appUser.findUnique({ where: { id: user.id }, select: { olympiadId: true } });
    return NextResponse.json(await stateCompetitionFor(user.id, me?.olympiadId), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (err) {
    console.error('GET app/state-competition failed:', err);
    return NextResponse.json({ error: 'Could not load the State Level status.' }, { status: 500 });
  }
}
