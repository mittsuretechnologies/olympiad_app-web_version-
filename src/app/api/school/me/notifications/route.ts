// School notifications are switched off for now. To bring them back, remove the "// " prefix below.
// import { NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';
// import { requireRole } from '@/lib/auth-guard';
//
// export const dynamic = 'force-dynamic';
//
// // GET -> the School Panel bell: the school's latest notifications plus how
// // many are unread. A missing table reads as "no notifications".
// export async function GET(request: Request) {
//   const { payload, error } = requireRole(request, ['SCHOOL']);
//   if (error) return error;
//
//   try {
//     const [items, unread] = await Promise.all([
//       prisma.schoolNotification.findMany({
//         where: { schoolId: payload.id },
//         orderBy: { createdAt: 'desc' },
//         take: 30,
//         select: { id: true, type: true, title: true, message: true, link: true, readAt: true, createdAt: true },
//       }),
//       prisma.schoolNotification.count({ where: { schoolId: payload.id, readAt: null } }),
//     ]);
//     return NextResponse.json({ unread, items });
//   } catch (err) {
//     console.error('GET school/me/notifications failed:', err);
//     return NextResponse.json({ unread: 0, items: [] });
//   }
// }
//
export {};
