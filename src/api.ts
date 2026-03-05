/* api.ts — API Client for jiun-api */

import { getAccessToken, refreshToken } from './auth';

const API_BASE = 'https://api.jiun.dev/nova-pouch';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet(
  path: string,
  params: Record<string, string | number | null | undefined> = {},
  timeoutMs = 2000,
): Promise<unknown> {
  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, String(value));
  }

  const doFetch = async () => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url.toString(), {
        headers: authHeaders(),
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as Record<string, string>;
        throw new ApiError(response.status, body.message || response.statusText);
      }
      return response.json();
    } catch (error) {
      clearTimeout(tid);
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, (error as Error).message || 'Network error');
    }
  };

  try {
    return await doFetch();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && getAccessToken()) {
      const newToken = await refreshToken();
      if (newToken) return doFetch();
    }
    throw error;
  }
}

export async function apiPost(
  path: string,
  body: unknown,
  timeoutMs = 15000,
): Promise<unknown> {
  const doFetch = async () => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(API_BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as Record<string, string>;
        throw new ApiError(response.status, data.message || response.statusText);
      }
      return response.json();
    } catch (error) {
      clearTimeout(tid);
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, (error as Error).message || 'Network error');
    }
  };

  try {
    return await doFetch();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && getAccessToken()) {
      const newToken = await refreshToken();
      if (newToken) return doFetch();
    }
    throw error;
  }
}
