import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-guard';
import { loadHomeLayout, saveHomeOrder, setSectionVisible } from '@/lib/homeLayout';
import { browseGroups, browseWhere, invalidateCategoryCache, loadAllCategories } from '@/lib/uploadCategories';
import {
  CLASS_LETTERS, ORDER_LISTS, checkAgainstOthers, cleanInput, createCategory, saveOrder,
} from '@/lib/uploadCategoriesAdmin';

export const dynamic = 'force-dynamic';

// SuperAdmin → Upload Categories.
//
// GET: every category with every option, plus how many videos carry each
// stored category name (so the admin sees what a change affects).
export async function GET(request: Request) {
  const { error } = await requireAdmin(request, 'uploadCategories');
  if (error) return error;
  try {
    invalidateCategoryCache();
    const [categories, counts] = await Promise.all([
      loadAllCategories(),
      prisma.video.groupBy({
        by: ['category'],
        where: { deletedAt: null, category: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const videoCounts = Object.fromEntries(counts.map((c) => [c.category as string, c._count._all]));
    // Approved public videos each Search card / Home row shows (Olympiad ones included).
    const groups = browseGroups(categories);
    const shown = await Promise.all(groups.map((g) => prisma.video.count({
      where: { deletedAt: null, status: 'APPROVED', isPublic: true, ...browseWhere(g) },
    })));
    const browseCounts = Object.fromEntries(groups.map((g, i) => [g.category.id, shown[i]]));
    const homeLayout = await loadHomeLayout(categories);
    return NextResponse.json({ categories, videoCounts, browseCounts, homeLayout, classLetters: CLASS_LETTERS });
  } catch (e: any) {
    console.error('GET /api/dashboard/upload-categories failed:', e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// POST: a new (normal) category.
export async function POST(request: Request) {
  const { error } = await requireAdmin(request, 'uploadCategories');
  if (error) return error;
  try {
    const input = cleanInput(await request.json());
    if (typeof input === 'string') return NextResponse.json({ message: input }, { status: 400 });
    const problem = await checkAgainstOthers(input, null);
    if (problem) return NextResponse.json({ message: problem }, { status: 400 });
    const id = await createCategory(input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/dashboard/upload-categories failed:', e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// PATCH { list: 'upload' | 'search' | 'home', order: [id, …] } — one of the
// three display orders, the whole list.
export async function PATCH(request: Request) {
  const { error } = await requireAdmin(request, 'uploadCategories');
  if (error) return error;
  try {
    const body = await request.json();
    // { section, visible } — switch a non-category Home section on or off.
    if (typeof body.section === 'string') {
      const problem = await setSectionVisible(body.section, body.visible === true, await loadAllCategories());
      if (problem) return NextResponse.json({ message: problem }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    const { list, order } = body;
    if (!Object.keys(ORDER_LISTS).includes(list)) {
      return NextResponse.json({ message: 'Unknown list' }, { status: 400 });
    }
    if (!Array.isArray(order) || order.some((x) => typeof x !== 'string')) {
      return NextResponse.json({ message: 'order must be a list of ids' }, { status: 400 });
    }
    // The Home order is one list of keys (sections and categories together).
    if (list === 'home') await saveHomeOrder(order, await loadAllCategories());
    else await saveOrder(list, order);
    invalidateCategoryCache();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PATCH /api/dashboard/upload-categories failed:', e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
