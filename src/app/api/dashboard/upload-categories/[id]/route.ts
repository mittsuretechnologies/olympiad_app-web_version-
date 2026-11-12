import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import {
  checkAgainstOthers, cleanInput, deleteCategory, findCategory, setCategoryFlags, updateCategory,
} from '@/lib/uploadCategoriesAdmin';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ message: 'Category not found' }, { status: 404 });

// PUT: save the whole category (name, look, who uploads into it, Search /
// Home settings, options).
export async function PUT(request: Request, { params }: Ctx) {
  const { error } = await requireAdmin(request, 'uploadCategories');
  if (error) return error;
  try {
    const existing = await findCategory((await params).id);
    if (!existing) return notFound();
    const input = cleanInput(await request.json());
    if (typeof input === 'string') return NextResponse.json({ message: input }, { status: 400 });
    const problem = await checkAgainstOthers(input, existing);
    if (problem) return NextResponse.json({ message: problem }, { status: 400 });
    await updateCategory(existing, input);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PUT /api/dashboard/upload-categories/[id] failed:', e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// PATCH { isActive?, showInSearch?, showOnHome? } — the quick switches.
export async function PATCH(request: Request, { params }: Ctx) {
  const { error } = await requireAdmin(request, 'uploadCategories');
  if (error) return error;
  try {
    const existing = await findCategory((await params).id);
    if (!existing) return notFound();
    const problem = await setCategoryFlags(existing, await request.json());
    if (problem) return NextResponse.json({ message: problem }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('PATCH /api/dashboard/upload-categories/[id] failed:', e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// DELETE: a normal category. Videos already uploaded keep their category
// name as text; switching the category off is usually the better choice.
export async function DELETE(request: Request, { params }: Ctx) {
  const { error } = await requireAdmin(request, 'uploadCategories');
  if (error) return error;
  try {
    const existing = await findCategory((await params).id);
    if (!existing) return notFound();
    const problem = await deleteCategory(existing);
    if (problem) return NextResponse.json({ message: problem }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('DELETE /api/dashboard/upload-categories/[id] failed:', e);
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
