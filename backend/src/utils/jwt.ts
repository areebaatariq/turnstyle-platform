import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../types/user';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  userType: string;
}

export function generateToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    userType: user.userType,
  };

  const expiresInValue =
    /^\d+$/.test(JWT_EXPIRES_IN) ? Number(JWT_EXPIRES_IN) : JWT_EXPIRES_IN;
  const options: SignOptions = {
    expiresIn: expiresInValue as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
