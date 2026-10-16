import { requireAdmin } from '@/lib/auth-guard';

// SuperAdmin, or a MasterAdmin granted the Report Infringement module.
// Returns the caller's token payload, or null when they may not act here.
export async function requireInfringementAdmin(request: Request) {
  const { payload } = await requireAdmin(request, 'infringement');
  return payload ?? null;
}
