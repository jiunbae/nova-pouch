/* auth.ts — OAuth authentication module */

let AUTH_API_BASE = 'https://api.jiun.dev/auth'; // default, overridden at init
let _enabledProviders: string[] = ['google', 'github', 'kakao', 'naver', 'twitter']; // default, overridden at init
const TOKEN_KEY = 'nova-pouch-access-token';
const AUTH_TIMEOUT_MS = 5000;

async function loadAuthConfig(): Promise<void> {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = (await res.json()) as { authApiUrl?: string; authProviders?: string[] };
      if (data.authApiUrl) AUTH_API_BASE = data.authApiUrl;
      if (Array.isArray(data.authProviders)) _enabledProviders = data.authProviders;
    }
  } catch {
    // Fall back to defaults
  }
}

export function getEnabledProviders(): string[] {
  return _enabledProviders;
}

function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(tid));
}

export interface AuthUser {
  id: string;
  provider: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthState {
  isLoggedIn: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
}

type AuthListener = (state: AuthState) => void;

let _state: AuthState = {
  isLoggedIn: false,
  user: null,
  token: null,
  isLoading: false,
};

const _listeners: Set<AuthListener> = new Set();

function setState(partial: Partial<AuthState>): void {
  _state = { ..._state, ...partial };
  for (const fn of _listeners) fn(_state);
}

export function getAuthState(): AuthState {
  return _state;
}

export function subscribeAuth(listener: AuthListener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

export function getAccessToken(): string | null {
  return _state.token;
}

export async function initAuth(): Promise<void> {
  await loadAuthConfig();

  // Handle GitHub Pages SPA redirect (?p=/auth/callback#access_token=...)
  const urlParams = new URLSearchParams(window.location.search);
  const redirectPath = urlParams.get('p');
  if (redirectPath === '/auth/callback') {
    urlParams.delete('p');
    const cleanSearch = urlParams.toString();
    history.replaceState(null, '', '/' + (cleanSearch ? '?' + cleanSearch : '') + window.location.hash);
  }

  // 1. Extract token from URL hash (OAuth callback)
  const hash = window.location.hash;
  if (hash.includes('access_token=')) {
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get('access_token');
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  // 2. Try stored token
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  setState({ isLoading: true, token });

  // 3. Verify with /auth/me
  const user = await fetchMe(token);
  if (user) {
    setState({ isLoggedIn: true, user, token, isLoading: false });
    return;
  }

  // 4. Token expired — try refresh
  const newToken = await refreshToken();
  if (newToken) {
    const refreshedUser = await fetchMe(newToken);
    if (refreshedUser) {
      setState({ isLoggedIn: true, user: refreshedUser, token: newToken, isLoading: false });
      return;
    }
  }

  // 5. All failed — clean up
  localStorage.removeItem(TOKEN_KEY);
  setState({ isLoggedIn: false, user: null, token: null, isLoading: false });
}

async function fetchMe(token: string): Promise<AuthUser | null> {
  try {
    const res = await authFetch(`${AUTH_API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AuthUser };
    return data.user;
  } catch {
    return null;
  }
}

export async function refreshToken(): Promise<string | null> {
  try {
    const res = await authFetch(`${AUTH_API_BASE}/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string };
    if (data.accessToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      setState({ token: data.accessToken });
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

export function startOAuthFlow(provider: string): void {
  if (!_enabledProviders.includes(provider)) return;
  const redirectUri = encodeURIComponent(window.location.origin);
  window.location.href = `${AUTH_API_BASE}/${provider}?redirect_uri=${redirectUri}`;
}

export async function logout(): Promise<void> {
  try {
    await authFetch(`${AUTH_API_BASE}/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Best-effort
  }
  localStorage.removeItem(TOKEN_KEY);
  setState({ isLoggedIn: false, user: null, token: null, isLoading: false });
}
