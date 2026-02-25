import type { Request, Response } from 'express';

import { GAME_ID } from '../config.js';

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL?.replace(/\/+$/, '') ??
  'https://auth.shark5060.net';
const DEFAULT_AUTH_SERVICE_URL = 'https://auth.shark5060.net';

function resolveAuthServiceUrl(req?: Request): string {
  if (!req) return AUTH_SERVICE_URL;
  try {
    const configuredHost = new URL(AUTH_SERVICE_URL).host.toLowerCase();
    const currentHost = getHost(req).toLowerCase();
    if (configuredHost === currentHost) {
      return DEFAULT_AUTH_SERVICE_URL;
    }
  } catch {
    return DEFAULT_AUTH_SERVICE_URL;
  }
  return AUTH_SERVICE_URL;
}

export interface RemoteAuthUser {
  id: number;
  username: string;
  is_admin: boolean;
}

export interface RemoteAuthState {
  authenticated: boolean;
  has_game_access: boolean;
  user: RemoteAuthUser | null;
  permissions: string[];
}

function getProto(req: Request): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (Array.isArray(forwardedProto)) return forwardedProto[0] || req.protocol;
  if (typeof forwardedProto === 'string' && forwardedProto.length > 0) {
    return forwardedProto.split(',')[0]?.trim() || req.protocol;
  }
  return req.protocol;
}

function getHost(req: Request): string {
  const forwardedHost = req.headers['x-forwarded-host'];
  if (Array.isArray(forwardedHost))
    return forwardedHost[0] || req.get('host') || '';
  if (typeof forwardedHost === 'string' && forwardedHost.length > 0) {
    return forwardedHost.split(',')[0]?.trim() || req.get('host') || '';
  }
  return req.get('host') || '';
}

export function buildAuthLoginUrl(req: Request, nextPath?: string): string {
  const host = getHost(req);
  const proto = getProto(req);
  const requested = nextPath || req.originalUrl || '/';
  const next = `${proto}://${host}${requested}`;
  const loginUrl = new URL(`${resolveAuthServiceUrl(req)}/login`);
  loginUrl.searchParams.set('next', next);
  return loginUrl.toString();
}

export async function fetchRemoteAuthState(
  req: Request,
  gameId = GAME_ID,
): Promise<RemoteAuthState> {
  const meUrl = new URL(`${resolveAuthServiceUrl(req)}/api/auth/me`);
  meUrl.searchParams.set('app', gameId);
  try {
    const upstream = await fetch(meUrl, {
      method: 'GET',
      headers: {
        cookie: req.headers.cookie ?? '',
        accept: 'application/json',
      },
    });
    if (!upstream.ok) {
      return {
        authenticated: false,
        has_game_access: false,
        user: null,
        permissions: [],
      };
    }
    const body = (await upstream.json()) as Partial<RemoteAuthState>;
    const user = body.user;
    return {
      authenticated: body.authenticated === true,
      has_game_access: body.has_game_access === true,
      user:
        user &&
        typeof user.id === 'number' &&
        typeof user.username === 'string' &&
        typeof user.is_admin === 'boolean'
          ? user
          : null,
      permissions: Array.isArray(body.permissions)
        ? body.permissions.filter((p): p is string => typeof p === 'string')
        : [],
    };
  } catch {
    return {
      authenticated: false,
      has_game_access: false,
      user: null,
      permissions: [],
    };
  }
}

export async function syncSessionFromAuth(
  req: Request,
): Promise<RemoteAuthState> {
  const state = await fetchRemoteAuthState(req, GAME_ID);
  if (!state.authenticated || !state.user) {
    delete req.session.user_id;
    delete req.session.username;
    delete req.session.is_admin;
    delete req.session.login_time;
    return state;
  }
  req.session.user_id = state.user.id;
  req.session.username = state.user.username;
  req.session.is_admin = state.user.is_admin;
  req.session.login_time = Date.now();
  return state;
}

export async function proxyAuthJson(
  req: Request,
  res: Response,
  path: string,
): Promise<void> {
  const url = `${resolveAuthServiceUrl(req)}${path}`;
  const method = req.method.toUpperCase();
  try {
    const upstream = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        cookie: req.headers.cookie ?? '',
      },
      body: method === 'GET' ? undefined : JSON.stringify(req.body ?? {}),
    });

    const setCookies = (
      upstream.headers as Headers & {
        getSetCookie?: () => string[];
      }
    ).getSetCookie?.();
    if (setCookies && setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    const contentType = upstream.headers.get('content-type');
    const responseText = await upstream.text();
    res.status(upstream.status);
    if (contentType && contentType.includes('application/json')) {
      res.type('application/json');
    }
    res.send(responseText);
  } catch {
    res.status(502).json({ error: 'Auth service unavailable' });
  }
}

export async function proxyAuthLogout(
  req: Request,
  res: Response,
): Promise<void> {
  const host = getHost(req);
  const proto = getProto(req);
  const next = `${proto}://${host}/login`;
  const logoutUrl = new URL(`${resolveAuthServiceUrl(req)}/logout`);
  logoutUrl.searchParams.set('next', next);

  try {
    const upstream = await fetch(logoutUrl, {
      method: 'GET',
      headers: {
        cookie: req.headers.cookie ?? '',
        accept: 'text/html',
      },
      redirect: 'manual',
    });

    const setCookies = (
      upstream.headers as Headers & {
        getSetCookie?: () => string[];
      }
    ).getSetCookie?.();

    if (setCookies && setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    }

    req.session.destroy(() => {
      res.json({ success: true });
    });
  } catch {
    req.session.destroy(() => {
      res.status(502).json({ error: 'Auth service unavailable' });
    });
  }
}
