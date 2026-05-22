// In-memory OTP store (replace with Redis/DB in production)
export const otpStore = new Map<string, { otp: string; expires: number; name: string; phone: string }>();
