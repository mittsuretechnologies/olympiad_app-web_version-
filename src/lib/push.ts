import { prisma } from '@/lib/prisma';

// Push notifications to the mobile app through Firebase Cloud Messaging.
//
// The server authenticates to Firebase with a service-account key, given in
// .env as FIREBASE_SERVICE_ACCOUNT: either the key file's JSON on one line, or
// that JSON base64-encoded. Without it every send is skipped quietly, so the
// rest of the server works the same before Firebase is set up.
//
// Every function here swallows its own errors: a push is a nice-to-have on top
// of whatever triggered it (a like, an approval, a share), never a reason for
// that action to fail.

type Messaging = import('firebase-admin/messaging').Messaging;

export interface PushMessage {
  title: string;
  body: string;
  // Read by the app when the notification is tapped, to open the right screen.
  // FCM only carries string values.
  data?: Record<string, string>;
}

let messagingPromise: Promise<Messaging | null> | null = null;

function readServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    console.error('[push] FIREBASE_SERVICE_ACCOUNT is not valid JSON (or base64 JSON)');
    return null;
  }
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT?.trim());
}

async function getMessaging(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const account = readServiceAccount();
      if (!account) return null;
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');
      const { getMessaging: fcm } = await import('firebase-admin/messaging');
      const app = getApps().find(a => a.name === 'mittmee-push')
        ?? initializeApp({ credential: cert(account as any) }, 'mittmee-push');
      return fcm(app);
    })().catch((e) => {
      console.error('[push] could not start Firebase:', e?.message || e);
      return null;
    });
  }
  return messagingPromise;
}

// Tokens Firebase says are gone for good (app uninstalled, data cleared).
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// FCM accepts at most 500 tokens per multicast call.
const BATCH = 500;

async function sendToTokens(tokens: string[], msg: PushMessage): Promise<number> {
  if (tokens.length === 0) return 0;
  const messaging = await getMessaging();
  if (!messaging) return 0;

  let delivered = 0;
  const dead: string[] = [];
  for (let i = 0; i < tokens.length; i += BATCH) {
    const chunk = tokens.slice(i, i + BATCH);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title: msg.title, body: msg.body },
        data: msg.data,
        android: {
          priority: 'high',
          notification: { channelId: 'mittmee_default', sound: 'default' },
        },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      delivered += res.successCount;
      res.responses.forEach((r, idx) => {
        if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) dead.push(chunk[idx]);
      });
    } catch (e: any) {
      console.error('[push] send failed:', e?.message || e);
    }
  }

  if (dead.length) {
    await prisma.pushToken.deleteMany({ where: { token: { in: dead } } }).catch(() => {});
  }
  return delivered;
}

/** Sends one notification to every phone of the given app users (AppUser.id). */
export async function sendPushToUsers(appUserIds: string[], msg: PushMessage): Promise<number> {
  try {
    if (!isPushConfigured() || appUserIds.length === 0) return 0;
    const rows = await prisma.pushToken.findMany({
      where: { appUserId: { in: [...new Set(appUserIds)] } },
      select: { token: true },
    });
    return await sendToTokens(rows.map(r => r.token), msg);
  } catch (e: any) {
    console.error('[push] sendPushToUsers failed:', e?.message || e);
    return 0;
  }
}

export type BroadcastAudience = 'ALL' | 'STUDENTS' | 'GENERAL';

/** Audience filter for an admin broadcast, shared by the count and the send. */
export function broadcastUserWhere(audience: BroadcastAudience) {
  // Accounts in their deletion grace window don't get announcements.
  const base = { deletionRequestedAt: null as null };
  if (audience === 'STUDENTS') return { ...base, olympiadId: { not: null } };
  if (audience === 'GENERAL') return { ...base, olympiadId: null };
  return base;
}

/** Sends to every phone registered by users in the audience. */
export async function sendPushBroadcast(audience: BroadcastAudience, msg: PushMessage): Promise<number> {
  try {
    if (!isPushConfigured()) return 0;
    const rows = await prisma.pushToken.findMany({
      where: { appUser: broadcastUserWhere(audience) },
      select: { token: true },
    });
    return await sendToTokens(rows.map(r => r.token), msg);
  } catch (e: any) {
    console.error('[push] broadcast failed:', e?.message || e);
    return 0;
  }
}
