// In-memory OTP store (replace with Redis/DB in production)
export const MAX_OTP_ATTEMPTS = 5;

export const otpStore = new Map<string, {
  otp: string;
  expires: number;
  name: string;
  phone: string;
  attempts: number;
}>();
