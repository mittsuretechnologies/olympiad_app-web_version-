// In-memory OTP store for viewer password reset (replace with Redis in production)
export const MAX_VIEWER_OTP_ATTEMPTS = 5;

export const viewerOtpStore = new Map<string, { otp: string; expires: number; attempts: number }>();
