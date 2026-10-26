// School notifications are switched off for now. To bring them back, remove the "// " prefix below.
// import { NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';
// import { requireAdmin } from '@/lib/auth-guard';
//
// export const dynamic = 'force-dynamic';
//
// // GET /api/dashboard/school-notifications/schools?q= — recipient picker for the
// // compose form: the states schools are in, and up to 15 schools matching q.
// export async function GET(request: Request) {
//   const { error } = await requireAdmin(request, 'schools.view');
//   if (error) return error;
//   try {
//     const q = (new URL(request.url).searchParams.get('q') || '').trim();
//     const [states, schools] = await Promise.all([
//       prisma.school.findMany({ where: { isActive: true, state: { not: null } }, distinct: ['state'], select: { state: true }, orderBy: { state: 'asc' } }),
//       q
//         ? prisma.school.findMany({
//             where: { isActive: true, OR: [{ name: { contains: q, mode: 'insensitive' } }, { schoolId: { contains: q, mode: 'insensitive' } }] },
//             select: { schoolId: true, name: true, city: true, state: true },
//             orderBy: { name: 'asc' },
//             take: 15,
//           })
//         : Promise.resolve([]),
//     ]);
//     return NextResponse.json({ states: states.map(s => s.state).filter(Boolean), schools });
//   } catch (err) {
//     console.error('GET school-notifications/schools failed:', err);
//     return NextResponse.json({ message: 'Failed to load schools' }, { status: 500 });
//   }
// }
//
export {};
