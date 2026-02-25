import cookieParser from 'cookie-parser';
import { csrfSync } from 'csrf-sync';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  authLoginRedirect,
  requireAuthApi,
  requireAdmin,
  requireGameAccess,
  requirePageGameAccess,
} from './auth/middleware.js';
import {
  PORT,
  HOST,
  SESSION_SECRET,
  NODE_ENV,
  CENTRAL_DB_PATH,
  TRUST_PROXY,
  SECURE_COOKIES,
  COOKIE_DOMAIN,
  GAME_ID,
  APP_NAME,
  PROJECT_ROOT,
  IMAGES_DIR,
  ensureDataDirs,
} from './config.js';
import { createCentralSchema } from './db/centralSchema.js';
import { getCentralDb } from './db/connection.js';
import { createAppSchema } from './db/schema.js';
import { seedArchonShards } from './db/seedArchonShards.js';
import { runStartupPipeline } from './import/startupPipeline.js';
import { apiRouter } from './routes/api.js';
import { authRouter } from './routes/auth.js';
import { corpusRouter } from './routes/corpus.js';
import { importRouter } from './routes/import.js';

const require = createRequire(import.meta.url);
const SQLiteStore = require('better-sqlite3-session-store')(session);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

ensureDataDirs();
createAppSchema();

const centralDb = getCentralDb();
createCentralSchema(centralDb);
console.log(`[${APP_NAME}] Central DB ready (${CENTRAL_DB_PATH})`);

try {
  seedArchonShards();
} catch (e) {
  console.warn('[DB] Archon shard seed skipped:', e);
}

const app = express();

if (TRUST_PROXY) app.set('trust proxy', 1);

app.use(helmet());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const sessionStore = new SQLiteStore({
  client: centralDb,
  expired: { clear: true, intervalMs: 15 * 60 * 1000 },
});

const cookieOptions: express.CookieOptions = {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: SECURE_COOKIES,
  sameSite: 'lax',
};
if (COOKIE_DOMAIN) cookieOptions.domain = COOKIE_DOMAIN;

app.use(
  session({
    name: 'parametric.sid',
    store: sessionStore,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: cookieOptions,
  }),
);

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req: express.Request) => {
    if (req.body?._csrf) return req.body._csrf as string;
    const q = req.query?._csrf;
    if (Array.isArray(q)) return (q[0] as string) ?? null;
    if (typeof q === 'string') return q;
    const header = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
    return (Array.isArray(header) ? header[0] : header) ?? null;
  },
  getTokenFromState: (req) => {
    const s = req.session;
    if (!s) return null;
    return (s as { csrfToken?: string }).csrfToken ?? null;
  },
  storeTokenInState: (req, token) => {
    if (req.session) {
      req.session.csrfToken = token as string;
    }
  },
});

app.use(csrfSynchronisedProtection);

app.use((req, res, next) => {
  (res.locals as { csrfToken?: string }).csrfToken = generateToken(req);
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const appApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicPageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authRouter);

app.use('/api/import', adminApiLimiter, requireAdmin, importRouter);
app.use('/api/corpus', adminApiLimiter, requireAdmin, corpusRouter);
app.use(
  '/api',
  appApiLimiter,
  requireAuthApi,
  requireGameAccess(GAME_ID),
  apiRouter,
);

app.use('/images', express.static(IMAGES_DIR));

app.use('/icons', express.static(path.join(PROJECT_ROOT, 'icons')));
app.get('/favicon.ico', publicPageLimiter, (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'favicon.ico'));
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (NODE_ENV === 'production') {
  const clientDir = path.resolve(__dirname, '..', 'client');
  app.use(publicPageLimiter, express.static(clientDir));

  app.get('/login', publicPageLimiter, (req, res) => {
    authLoginRedirect(req, res);
  });

  app.get(/.*/, publicPageLimiter, requirePageGameAccess, (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('[Error]', err.stack ?? err.message);
    res.status(500).json({ error: 'Internal server error' });
  },
);

app.listen(PORT, HOST, () => {
  console.log(
    `[${APP_NAME}] Server running on http://${HOST}:${PORT} (${NODE_ENV})`,
  );

  runStartupPipeline().catch((err) => {
    console.error('[Startup] Pipeline failed:', err);
  });
});

export default app;
