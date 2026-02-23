import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import {
  attemptLogin,
  createUser,
  deleteUser,
  changePassword,
  getAllUsers,
  getClientIP,
  getGamesForUser,
  hasAccess,
  setUserGameAccess,
} from '../auth/auth.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import {
  loginSchema,
  registerSchema,
  gameAccessSchema,
  changePasswordSchema,
  validateBody,
} from '../auth/validation.js';
import { GAME_ID } from '../config.js';

export const authRouter = Router();

authRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

/**
 * GET /api/auth/csrf
 * Provide the CSRF token for the SPA client.
 */
authRouter.get('/csrf', (req: Request, res: Response) => {
  const token =
    (res.locals as { csrfToken?: string }).csrfToken ?? req.session.csrfToken;
  res.json({ csrfToken: token ?? '' });
});

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  const data = validateBody(loginSchema, req.body, res);
  if (!data) return;

  try {
    const ip = getClientIP(req);
    const result = await attemptLogin(data.username, data.password, ip);

    if (!result.success) {
      res.status(401).json({ error: result.error });
      return;
    }

    req.session.user_id = result.user.id;
    req.session.username = result.user.username;
    req.session.is_admin = !!result.user.is_admin;
    req.session.login_time = Date.now();

    res.json({
      success: true,
      user: {
        id: result.user.id,
        username: result.user.username,
        is_admin: !!result.user.is_admin,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
      return;
    }
    res.json({ success: true });
  });
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', (req: Request, res: Response) => {
  if (!req.session.user_id) {
    res.json({ authenticated: false, has_game_access: false });
    return;
  }

  const hasGameAccess = hasAccess(req.session.user_id, GAME_ID);

  res.json({
    authenticated: true,
    has_game_access: hasGameAccess,
    user: {
      id: req.session.user_id,
      username: req.session.username,
      is_admin: req.session.is_admin,
    },
  });
});

/**
 * POST /api/auth/register (admin only)
 */
authRouter.post(
  '/register',
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const data = validateBody(registerSchema, req.body, res);
      if (!data) return;

      const result = await createUser(
        data.username,
        data.password,
        data.is_admin,
      );
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ success: true, user_id: result.user_id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  },
);

/**
 * GET /api/auth/users (admin only)
 */
authRouter.get('/users', requireAdmin, (_req: Request, res: Response) => {
  try {
    const users = getAllUsers();
    res.json({ users });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * DELETE /api/auth/users/:id (admin only)
 */
authRouter.delete('/users/:id', requireAdmin, (req: Request, res: Response) => {
  const targetId = parseInt(String(req.params.id), 10);
  if (isNaN(targetId)) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  const result = deleteUser(req.session.user_id!, targetId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

/**
 * POST /api/auth/change-password
 */
authRouter.post(
  '/change-password',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const data = validateBody(changePasswordSchema, req.body, res);
      if (!data) return;

      const result = await changePassword(
        req.session.user_id!,
        data.current_password,
        data.new_password,
      );
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  },
);

/**
 * POST /api/auth/game-access (admin only)
 * Toggle game access for a user.
 */
authRouter.post('/game-access', requireAdmin, (req: Request, res: Response) => {
  try {
    const data = validateBody(gameAccessSchema, req.body, res);
    if (!data) return;

    setUserGameAccess(data.user_id, data.game_id, data.enabled);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/auth/users/:id/games (admin only)
 * List game access for a user.
 */
authRouter.get(
  '/users/:id/games',
  requireAdmin,
  (req: Request, res: Response) => {
    const userId = parseInt(String(req.params.id), 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }
    const games = getGamesForUser(userId);
    res.json({ games });
  },
);
