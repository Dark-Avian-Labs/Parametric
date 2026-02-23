import type { Request, Response, NextFunction } from 'express';

import {
  type AuthSession,
  isAuthenticated,
  isAdmin as checkAdmin,
  hasAccess,
} from './auth.js';

function getSession(req: Request): AuthSession {
  return req.session as AuthSession;
}

/**
 * Require authentication. Returns 401 JSON for unauthenticated requests.
 * Adapted for Parametric's SPA -- always returns JSON, never redirects.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isAuthenticated(getSession(req))) {
    next();
    return;
  }
  res.status(401).json({ error: 'Authentication required' });
}

/**
 * Require admin role. Returns 401 or 403 JSON.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const session = getSession(req);
  if (!isAuthenticated(session)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!checkAdmin(session)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Require game access for a specific game. Returns 401 or 403 JSON.
 */
export function requireGameAccess(gameId: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = getSession(req);
    if (!isAuthenticated(session)) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const userId = session?.user_id;
    if (typeof userId !== 'number') {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!hasAccess(userId, gameId)) {
      res
        .status(403)
        .json({ error: 'Access to this application is not granted.' });
      return;
    }
    next();
  };
}

/**
 * Require authentication for API routes. Returns 401 JSON.
 */
export function requireAuthApi(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isAuthenticated(getSession(req))) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}
