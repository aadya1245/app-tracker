import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error-handler.js';
import { verifyToken } from '../utils/jwt.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid authorization header');
  }

  const token = header.split(' ')[1];
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
}
