// The only place that talks HTTP. The access token lives in memory (never in
// localStorage); the refresh token lives in an HttpOnly cookie the browser
// sends to /api/v1/auth only, so JavaScript can never read either from disk.
//
// A request that gets 401 refreshes the session once and retries. Parallel
// requests share one refresh, and a refresh that loses a race with another tab
// (409 REFRESH_TOKEN_ROTATED) just tries again with the cookie that tab got.

const ORIGIN = import.meta.env.VITE_API_URL ?? "";
const BASE = `${ORIGIN}/api/v1`;
const SESSION_HEADERS = { "X-Session-Transport": "cookie" };

export type ApiErrorDetail = { field: string; code: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Absolute URL for a path the API returned (photo URLs). */
export function apiUrl(path: string) {
  return ORIGIN + path;
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let sessionLost: () => void = () => {};

/** Called when the session cannot be renewed: the app goes back to the login. */
export function onSessionLost(handler: () => void) {
  sessionLost = handler;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(BASE + path, { credentials: "include", ...init });
  } catch {
    throw new ApiError(0, "NETWORK", "Sin conexión. Revisa tu internet e inténtalo de nuevo.");
  }
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    if (body?.error) return new ApiError(res.status, body.error.code, body.error.message, body.error.details ?? []);
  } catch {
    // Not JSON: a proxy or the server down.
  }
  return new ApiError(res.status, "UNEXPECTED", "Algo salió mal. Inténtalo de nuevo.");
}

/** Renews the session with the cookie. Concurrent callers share one attempt. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await send("/auth/refresh", { method: "POST", headers: SESSION_HEADERS });
      if (res.ok) {
        const body = await res.json();
        accessToken = body.data.tokens.access_token;
        return true;
      }
      const error = await toError(res);
      if (error.code === "REFRESH_TOKEN_ROTATED") {
        await sleep(300 * (attempt + 1));
        continue;
      }
      if (error.status === 401) {
        accessToken = null;
        return false;
      }
      throw error;
    }
    return false;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  /** Raw bytes (a photo) instead of JSON. */
  blob?: Blob;
  /** Public routes (share page) go without a token. */
  anonymous?: boolean;
};

async function request(path: string, options: RequestOptions, retried = false): Promise<Response> {
  const headers: Record<string, string> = {};
  if (!options.anonymous && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let body: BodyInit | undefined;
  if (options.blob) {
    body = options.blob;
    headers["Content-Type"] = options.blob.type || "application/octet-stream";
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers["Content-Type"] = "application/json";
  }

  const res = await send(path, { method: options.method ?? "GET", headers, body });
  if (res.status === 401 && !options.anonymous && !retried) {
    if (await refreshSession()) return request(path, options, true);
    sessionLost();
  }
  if (!res.ok) throw await toError(res);
  return res;
}

/** Calls the API and returns `data`. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await request(path, options);
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  return body.data as T;
}

export type PageMeta = { page: number; page_size: number; total: number };

/** Calls a paginated route and returns `data` and `meta`. */
export async function apiPage<T>(path: string): Promise<{ data: T[]; meta: PageMeta }> {
  const res = await request(path, {});
  return res.json();
}

export type UserDto = { id: string; username: string; display_name: string; created_at: string };

export async function login(username: string, password: string): Promise<UserDto> {
  const res = await send("/auth/login", {
    method: "POST",
    headers: { ...SESSION_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw await toError(res);
  const body = await res.json();
  accessToken = body.data.tokens.access_token;
  return body.data.user;
}

export async function logout() {
  accessToken = null;
  await send("/auth/logout", { method: "POST", headers: SESSION_HEADERS }).catch(() => undefined);
}
