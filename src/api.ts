/* api.ts — API Client for jiun-api */

const API_BASE = 'https://api.jiun.dev/nova-pouch';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as Record<string, string>;
      throw new ApiError(response.status, body.message || response.statusText);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, (error as Error).message || 'Network error');
  }
}

export async function apiPost(
  path: string,
  body: unknown,
  timeoutMs = 15000,
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as Record<string, string>;
      throw new ApiError(response.status, data.message || response.statusText);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, (error as Error).message || 'Network error');
  }
}
