// Brute-force protection for the password login routes.
//
// Counts failed logins (a 401 from the wrapped handler) per account identifier
// and per client IP; once either passes its limit the caller gets a 429 for
// LOCK_MS without the handler running, so no bcrypt work is spent on it. A
// successful login clears that account's counter.
//
// State is in memory, like the infringement-notice limiter: it resets on a
// restart and is per process. That still stops online guessing against the
// single pm2 process this app runs as, without needing a DB table.

const MAX_FAILS_PER_ACCOUNT = 5;
const MAX_FAILS_PER_IP = 20;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED = 20000;

type Entry = { fails: number[]; lockedUntil: number };

const accounts = new Map<string, Entry>();
const ips = new Map<string, Entry>();

function clientIp(request: Request): string {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || request.headers.get('x-real-ip') || 'unknown';
}

function lockRemaining(map: Map<string, Entry>, key: string, now: number): number {
  const e = map.get(key);
  return e && e.lockedUntil > now ? e.lockedUntil - now : 0;
}

function recordFail(map: Map<string, Entry>, key: string, max: number, now: number) {
  const e = map.get(key) ?? { fails: [], lockedUntil: 0 };
  e.fails = e.fails.filter((t) => now - t < WINDOW_MS);
  e.fails.push(now);
  if (e.fails.length >= max) {
    e.lockedUntil = now + LOCK_MS;
    e.fails = [];
  }
  map.set(key, e);
  if (map.size > MAX_TRACKED) {
    for (const [k, v] of map) if (v.lockedUntil < now && v.fails.every((t) => now - t >= WINDOW_MS)) map.delete(k);
    if (map.size > MAX_TRACKED) map.clear();
  }
}

async function identifierOf(request: Request): Promise<string> {
  try {
    const b: any = await request.clone().json();
    const raw = b?.identifier ?? b?.email ?? b?.username ?? b?.userId ?? b?.olympiadCode
      ?? b?.evaluatorId ?? b?.reviewerId ?? '';
    return String(raw).trim().toLowerCase().slice(0, 200);
  } catch {
    return '';
  }
}

export function withLoginRateLimit(handler: (request: Request) => Promise<Response>) {
  return async function limited(request: Request): Promise<Response> {
    const now = Date.now();
    const ip = clientIp(request);
    const id = await identifierOf(request);

    const wait = Math.max(
      lockRemaining(ips, ip, now),
      id ? lockRemaining(accounts, id, now) : 0,
    );
    if (wait > 0) {
      const minutes = Math.ceil(wait / 60000);
      return new Response(
        JSON.stringify({
          message: `Too many failed login attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(wait / 1000)) } },
      );
    }

    const response = await handler(request);

    if (response.status === 401) {
      recordFail(ips, ip, MAX_FAILS_PER_IP, now);
      if (id) recordFail(accounts, id, MAX_FAILS_PER_ACCOUNT, now);
    } else if (response.status === 200 && id) {
      accounts.delete(id);
    }
    return response;
  };
}
