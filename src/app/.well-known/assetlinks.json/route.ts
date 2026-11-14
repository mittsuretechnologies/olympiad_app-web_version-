import { NextResponse } from 'next/server';
import { ANDROID_PACKAGE } from '@/lib/shareLink';

export const dynamic = 'force-dynamic';

// Android App Links verification. ANDROID_CERT_SHA256 = SHA-256 fingerprint(s) of
// the Play app-signing key (Play Console -> App signing), comma-separated.
export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  return NextResponse.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints },
    },
  ]);
}
