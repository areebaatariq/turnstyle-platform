import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userType?: string;
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: { message: 'Access token required' } });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.userType = payload.userType;
    next();
  } catch (error) {
    return res.status(403).json({ error: { message: 'Invalid or expired token' } });
  }
}
