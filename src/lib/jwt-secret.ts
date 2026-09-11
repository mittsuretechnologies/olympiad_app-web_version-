// Centralized JWT secret accessor. Throws instead of silently falling back to a
// public default — a deployment with JWT_SECRET unset must fail closed, not
// start signing/verifying tokens with a value visible in source control.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}
