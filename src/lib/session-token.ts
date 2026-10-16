// Client-side token helpers. These only read the JWT's unverified `exp` claim to
// keep the UI honest about expired sessions — the server still verifies every
// token signature (see requireRole in src/lib/auth-guard.ts). Never trust these
// for authorization decisions.

export function isTokenExpired(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return true;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload?.exp !== 'number') return true;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

// The unverified `role` claim — for choosing what UI to show only. SuperAdmin
// and MasterAdmin both sign in under the 'token' key, so its presence alone no
// longer tells them apart.
export function tokenRole(token: string | null): string | null {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function clearSchoolSession() {
  sessionStorage.removeItem('schoolToken');
  sessionStorage.removeItem('schoolUser');
}
