let cachedToken: string | null = null;
let inFlightPromise: Promise<string | null> | null = null;
let csrfTokenGeneration = 0;
let authRedirectPending = false;
let apiRequestSeq = 0;
export const API_UNAUTHORIZED_EVENT = 'parametric:api-unauthorized';

function currentAppPath(): string {
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

function isAuthDebugEnabled(): boolean {
  try {
    return (
      window.localStorage.getItem('parametric:auth-debug') === '1' ||
      window.sessionStorage.getItem('parametric:auth-debug') === '1'
    );
  } catch {
    return false;
  }
}

function debugAuthLog(message: string, details?: unknown): void {
  if (!isAuthDebugEnabled()) return;
  if (details !== undefined) {
    console.info(`[AuthDebug] ${message}`, details);
    return;
  }
  console.info(`[AuthDebug] ${message}`);
}

export function buildCentralAuthLoginUrl(nextPath?: string): string {
  const next = nextPath && nextPath.length > 0 ? nextPath : currentAppPath();
  return `/api/auth/login?next=${encodeURIComponent(next)}`;
}

export function redirectToCentralAuth(nextPath?: string): void {
  if (authRedirectPending) return;
  authRedirectPending = true;
  debugAuthLog('redirectToCentralAuth', { nextPath });
  window.location.href = buildCentralAuthLoginUrl(nextPath);
}

function emitUnauthorized(url: string): void {
  debugAuthLog('emitUnauthorized', { url });
  window.dispatchEvent(
    new CustomEvent(API_UNAUTHORIZED_EVENT, {
      detail: { url },
    }),
  );
}

async function getCsrfToken(): Promise<string | null> {
  if (cachedToken !== null) {
    return cachedToken;
  }
  if (inFlightPromise !== null) {
    return await inFlightPromise;
  }

  const generationAtStart = csrfTokenGeneration;
  const ref = { promise: null as Promise<string | null> | null };
  inFlightPromise = ref.promise = (async () => {
    try {
      const res = await fetch('/api/auth/csrf', { credentials: 'include' });
      if (!res.ok) {
        return null;
      }
      const body = (await res.json()) as { csrfToken?: string };
      if (!body.csrfToken) {
        return null;
      }
      if (generationAtStart === csrfTokenGeneration) {
        cachedToken = body.csrfToken;
      }
      return body.csrfToken;
    } catch {
      return null;
    } finally {
      if (inFlightPromise === ref.promise) inFlightPromise = null;
    }
  })();

  const token = await inFlightPromise;
  if (token === null) {
    cachedToken = null;
  }
  return token;
}

export function clearCsrfToken(): void {
  csrfTokenGeneration += 1;
  cachedToken = null;
  inFlightPromise = null;
}

export class UnauthorizedError extends Error {
  readonly response: Response;
  readonly url: string;

  constructor(url: string, response: Response) {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
    this.url = url;
    this.response = response;
  }
}

async function isCsrfFailureResponse(response: Response): Promise<boolean> {
  const csrfErrorHeader = response.headers.get('X-CSRF-Error');
  if (response.status === 403 && csrfErrorHeader === '1') {
    return true;
  }

  try {
    const body = (await response.clone().json()) as {
      code?: string;
      errorCode?: string;
      error_code?: string;
      error?: string;
      message?: string;
    };
    const code = body.code ?? body.errorCode ?? body.error_code;
    const details = `${body.error ?? ''} ${body.message ?? ''}`.toLowerCase();
    return (
      response.status === 403 &&
      (code === 'CSRF_INVALID' || details.includes('csrf'))
    );
  } catch {
    try {
      const text = (await response.clone().text()).toLowerCase();
      return response.status === 403 && text.includes('csrf');
    } catch {
      return false;
    }
  }
}

function setJsonContentType(headers: Headers, init?: RequestInit): void {
  if (
    !headers.has('Content-Type') &&
    init?.body &&
    typeof init.body === 'string'
  ) {
    try {
      const parsed = JSON.parse(init.body) as unknown;
      if (
        Array.isArray(parsed) ||
        (parsed !== null && typeof parsed === 'object')
      ) {
        headers.set('Content-Type', 'application/json');
      }
    } catch {
      // ignore
    }
  }
}

function injectCsrfIntoJsonBody(
  body: BodyInit | null | undefined,
  csrfToken: string,
): BodyInit | null | undefined {
  if (typeof body !== 'string') {
    return body;
  }
  const trimmed = body.trimStart();
  if (!trimmed.startsWith('{')) {
    return body;
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return body;
    }
    if (typeof parsed._csrf === 'string' && parsed._csrf.length > 0) {
      return body;
    }
    return JSON.stringify({ ...parsed, _csrf: csrfToken });
  } catch {
    return body;
  }
}

export async function apiFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const requestId = ++apiRequestSeq;
  const method = (init?.method ?? 'GET').toUpperCase();
  const needsCsrf =
    method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  debugAuthLog(`apiFetch#${requestId} start`, { method, url, needsCsrf });

  const headers = new Headers(init?.headers);
  setJsonContentType(headers, init);
  let requestBody = init?.body;

  if (needsCsrf) {
    const csrfToken = await getCsrfToken();
    if (csrfToken === null) {
      throw new Error('Failed to fetch CSRF token');
    }
    headers.set('X-CSRF-Token', csrfToken);
    requestBody = injectCsrfIntoJsonBody(requestBody, csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: init?.credentials ?? 'include',
      headers,
      body: requestBody,
    });
  } catch (error) {
    debugAuthLog(`apiFetch#${requestId} network-failure`, { url, error });
    throw error;
  }
  debugAuthLog(`apiFetch#${requestId} response`, {
    url,
    status: response.status,
  });
  if (response.status === 401) {
    emitUnauthorized(url);
    throw new UnauthorizedError(url, response);
  }
  if (!needsCsrf || !(await isCsrfFailureResponse(response))) {
    return response;
  }

  clearCsrfToken();
  const freshCsrfToken = await getCsrfToken();
  if (freshCsrfToken === null) {
    throw new Error('Failed to refresh CSRF token');
  }

  const retryHeaders = new Headers(init?.headers);
  setJsonContentType(retryHeaders, init);
  retryHeaders.set('X-CSRF-Token', freshCsrfToken);
  const retryBody = injectCsrfIntoJsonBody(init?.body, freshCsrfToken);
  debugAuthLog(`apiFetch#${requestId} csrf-retry`, { url });
  const retryResponse = await fetch(url, {
    ...init,
    credentials: init?.credentials ?? 'include',
    headers: retryHeaders,
    body: retryBody,
  });
  debugAuthLog(`apiFetch#${requestId} csrf-retry-response`, {
    url,
    status: retryResponse.status,
  });
  if (retryResponse.status === 401) {
    emitUnauthorized(url);
    throw new UnauthorizedError(url, retryResponse);
  }
  return retryResponse;
}
