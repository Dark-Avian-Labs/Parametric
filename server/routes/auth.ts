import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import {
  authLoginRedirect,
  authStatus,
  redirectIfAuthenticated,
  requireAdmin,
} from '../auth/middleware.js';
import { proxyAuthJson, proxyAuthLogout } from '../auth/remoteAuth.js';

export const authRouter = Router();
const AUTH_SERVICE_BASE =
  process.env.AUTH_SERVICE_URL?.trim() || 'http://localhost:3010';
const AUTH_ADMIN_URL = `${AUTH_SERVICE_BASE.replace(/\/+$/, '')}/admin`;

authRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

authRouter.get('/csrf', (req: Request, res: Response) => {
  const token =
    (res.locals as { csrfToken?: string }).csrfToken ?? req.session.csrfToken;
  res.json({ csrfToken: token ?? '' });
});

authRouter.get(
  '/login',
  redirectIfAuthenticated,
  (req: Request, res: Response) => {
    authLoginRedirect(req, res);
  },
);

authRouter.post('/login', async (req: Request, res: Response) => {
  await proxyAuthJson(req, res, '/api/auth/login');
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  await proxyAuthLogout(req, res);
});

authRouter.get('/me', authStatus);

authRouter.post('/change-password', async (req: Request, res: Response) => {
  await proxyAuthJson(req, res, '/api/auth/change-password');
});

function userMgmtMoved(res: Response): void {
  res.status(410).json({
    error: `User management moved to the Auth application. Use ${AUTH_ADMIN_URL}.`,
  });
}

authRouter.post('/register', requireAdmin, (_req: Request, res: Response) => {
  userMgmtMoved(res);
});

authRouter.get('/users', requireAdmin, (_req: Request, res: Response) => {
  userMgmtMoved(res);
});

authRouter.delete(
  '/users/:id',
  requireAdmin,
  (_req: Request, res: Response) => {
    userMgmtMoved(res);
  },
);

authRouter.post(
  '/game-access',
  requireAdmin,
  (_req: Request, res: Response) => {
    userMgmtMoved(res);
  },
);

authRouter.get(
  '/users/:id/games',
  requireAdmin,
  (_req: Request, res: Response) => {
    userMgmtMoved(res);
  },
);
