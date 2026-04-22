import crypto from 'crypto';

export const tokenUtil = {
  /**
   * Generate a random secure token for email verification
   */
  generateEmailVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  },

  /**
   * Generate a 6-digit OTP for password reset
   */
  generateOTP(): string {
    return crypto.randomInt(100000, 1000000).toString();
  },

  /**
   * Hash a token for secure storage
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  },
};
