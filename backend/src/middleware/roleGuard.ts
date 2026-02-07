import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Role-based access control middleware
 * Enforces that only users with specific roles can access certain endpoints
 */

/**
 * Middleware to allow only stylists
 */
export function requireStylist(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.userType !== 'stylist') {
    return res.status(403).json({ 
      error: { message: 'Access denied. This action requires stylist privileges.' } 
    });
  }
  next();
}

/**
 * Middleware to allow only clients
 */
export function requireClient(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (req.userType !== 'client') {
    return res.status(403).json({ 
      error: { message: 'Access denied. This action requires client privileges.' } 
    });
  }
  next();
}

/**
 * Middleware to allow both stylists and clients
 * Useful for explicit role checking
 */
export function requireAuthenticated(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.userId || !req.userType) {
    return res.status(401).json({ 
      error: { message: 'Authentication required.' } 
    });
  }
  next();
}
