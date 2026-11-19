import { prisma } from '@/lib/prisma';

// SuperAdmin switch for the "Is this video for MittFest?" checkbox on the
// app's upload screen. Stored in AppSetting as 'true' / 'false'. No row yet
// means ON, so the checkbox keeps showing until someone turns it off.
export const MITTFEST_CHECKBOX_KEY = 'MITTFEST_CHECKBOX_ENABLED';

export interface MittfestSettings {
  checkboxEnabled: boolean;
  updatedAt: string | null;
}

export async function getMittfestSettings(): Promise<MittfestSettings> {
  const row = await prisma.appSetting.findUnique({ where: { key: MITTFEST_CHECKBOX_KEY } });
  return {
    checkboxEnabled: row ? row.value !== 'false' : true,
    updatedAt: row ? row.updatedAt.toISOString() : null,
  };
}

export async function isMittfestCheckboxEnabled(): Promise<boolean> {
  return (await getMittfestSettings()).checkboxEnabled;
}

export async function setMittfestCheckboxEnabled(enabled: boolean): Promise<MittfestSettings> {
  const value = enabled ? 'true' : 'false';
  await prisma.appSetting.upsert({
    where: { key: MITTFEST_CHECKBOX_KEY },
    update: { value },
    create: { key: MITTFEST_CHECKBOX_KEY, value },
  });
  return getMittfestSettings();
}
