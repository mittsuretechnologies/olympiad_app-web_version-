// School notifications are switched off for now. To bring them back, remove the "// " prefix below.
// import { NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';
// import { requireRole } from '@/lib/auth-guard';
//
// export const dynamic = 'force-dynamic';
//
// // POST { ids?: string[] } -> mark some (or, with no ids, all) of this school's
// // notifications as read. Only ever touches the caller's own rows.
// export async function POST(request: Request) {
//   const { payload, error } = requireRole(request, ['SCHOOL']);
//   if (error) return error;
//
//   try {
//     const body = await request.json().catch(() => ({}));
//     const ids: string[] | null = Array.isArray(body?.ids)
//       ? body.ids.filter((v: unknown): v is string => typeof v === 'string').slice(0, 100)
//       : null;
//     await prisma.schoolNotification.updateMany({
//       where: { schoolId: payload.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
//       data: { readAt: new Date() },
//     });
//     return NextResponse.json({ ok: true });
//   } catch (err) {
//     console.error('POST school/me/notifications/read failed:', err);
//     return NextResponse.json({ message: 'Failed to update notifications' }, { status: 500 });
//   }
// }
//
export {};
