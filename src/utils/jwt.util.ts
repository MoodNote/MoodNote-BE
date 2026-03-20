import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth.config';

export interface JwtPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export const jwtUtil = {
  /**
   * Generate access token (24 hours)
   */
  generateAccessToken(userId: string, email: string): string {
    const payload: JwtPayload = {
      userId,
      email,
      type: 'access',
    };
    return jwt.sign(payload, authConfig.jwt.secret, {
      expiresIn: authConfig.jwt.expiresIn as jwt.SignOptions['expiresIn'],
    });
  },

  /**
   * Generate refresh token (7 days)
   */
  generateRefreshToken(userId: string, email: string): string {
    const payload: JwtPayload = {
      userId,
      email,
      type: 'refresh',
    };
    return jwt.sign(payload, authConfig.jwt.refreshSecret, {
      expiresIn: authConfig.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    });
  },

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, authConfig.jwt.secret) as JwtPayload;
  },

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): JwtPayload {
    return jwt.verify(token, authConfig.jwt.refreshSecret) as JwtPayload;
  },

  /**
   * Generate admin access token (1 hour, separate secret)
   */
  generateAdminAccessToken(userId: string, email: string): string {
    const payload: JwtPayload = {
      userId,
      email,
      type: 'access',
    };
    return jwt.sign(payload, authConfig.jwt.adminSecret, {
      expiresIn: authConfig.jwt.adminExpiresIn as jwt.SignOptions['expiresIn'],
    });
  },

  /**
   * Verify admin access token (uses admin secret)
   */
  verifyAdminAccessToken(token: string): JwtPayload {
    return jwt.verify(token, authConfig.jwt.adminSecret) as JwtPayload;
  },

  /**
   * Decode token without verification (for debugging)
   */
  decode(token: string): JwtPayload | null {
    return jwt.decode(token) as JwtPayload | null;
  },
};
