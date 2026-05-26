// In-memory OTP store for viewer password reset (replace with Redis in production)
export const viewerOtpStore = new Map<string, { otp: string; expires: number }>();
