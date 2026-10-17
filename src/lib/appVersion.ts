import { prisma } from '@/lib/prisma';

// Force-update rule for the mobile app, set by the SuperAdmin in
// Dashboard → Settings → App Version and read by the app on every launch
// (GET /api/app/version-check).
//
// The numbers are BUILD numbers, not "1.0.6"-style version names:
//   Android — versionCode (Play Console → App bundle explorer / Releases)
//   iOS     — build number / CFBundleVersion (App Store Connect → TestFlight)
// Build numbers only ever go up, so "below the minimum" is a plain comparison.
// 0 means "no minimum" — nobody is ever blocked on that platform.

export const ANDROID_PACKAGE = 'com.mittmee.app';

const KEYS = {
  androidMin: 'APP_MIN_BUILD_ANDROID',
  iosMin:     'APP_MIN_BUILD_IOS',
  message:    'APP_FORCE_UPDATE_MESSAGE',
  iosUrl:     'APP_IOS_STORE_URL',
} as const;

export const DEFAULT_FORCE_UPDATE_MESSAGE =
  'A new version of Mittmee is available. Please update the app to continue.';

export interface AppVersionSettings {
  androidMinBuild: number;
  iosMinBuild: number;
  message: string;
  iosStoreUrl: string;
  updatedAt: string | null;
}

const toBuild = (v: string | undefined) => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export async function getAppVersionSettings(): Promise<AppVersionSettings> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const latest = rows.reduce<Date | null>((d, r) => (!d || r.updatedAt > d ? r.updatedAt : d), null);
  return {
    androidMinBuild: toBuild(byKey.get(KEYS.androidMin)?.value),
    iosMinBuild:     toBuild(byKey.get(KEYS.iosMin)?.value),
    message:         byKey.get(KEYS.message)?.value?.trim() || DEFAULT_FORCE_UPDATE_MESSAGE,
    iosStoreUrl:     byKey.get(KEYS.iosUrl)?.value?.trim() || '',
    updatedAt:       latest ? latest.toISOString() : null,
  };
}

export async function setAppVersionSettings(input: {
  androidMinBuild: number;
  iosMinBuild: number;
  message: string;
  iosStoreUrl: string;
}): Promise<AppVersionSettings> {
  const values: Record<string, string> = {
    [KEYS.androidMin]: String(Math.max(0, Math.floor(input.androidMinBuild))),
    [KEYS.iosMin]:     String(Math.max(0, Math.floor(input.iosMinBuild))),
    [KEYS.message]:    input.message.trim(),
    [KEYS.iosUrl]:     input.iosStoreUrl.trim(),
  };
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } }),
    ),
  );
  return getAppVersionSettings();
}

export function androidStoreUrls() {
  return {
    storeUrl: `market://details?id=${ANDROID_PACKAGE}`,
    webUrl:   `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
  };
}
