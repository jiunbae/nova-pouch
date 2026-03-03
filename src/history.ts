import type { HistoryData, HistorySession, HistoryStats, NormalizedToken, PouchColor } from './types';

export const STORAGE_KEY = 'nova-pouch-history';
export const MAX_SESSIONS = 100;
const CURRENT_VERSION = 1;

export function createEmptyHistory(): HistoryData {
  return {
    version: CURRENT_VERSION,
    sessions: [],
    stats: {
      totalPlayed: 0,
      averageRating: 0,
      favoriteTokens: {}
    }
  };
}

export function loadHistory(): HistoryData {
  if (!canUseLocalStorage()) {
    return createEmptyHistory();
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptyHistory();
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return createEmptyHistory();
  }

  const migrated = migrateHistory(parsed);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  } catch {
    // Ignore storage write errors and still return parsed data.
  }

  return migrated;
}

export function saveSession(session: Record<string, unknown>): HistoryData {
  const history = loadHistory();
  const normalizedSession = normalizeSession(session);

  if (!normalizedSession) {
    return history;
  }

  history.sessions.unshift(normalizedSession);
  if (history.sessions.length > MAX_SESSIONS) {
    history.sessions = history.sessions.slice(0, MAX_SESSIONS);
  }

  history.stats = getStats(history);

  if (canUseLocalStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage quota or serialization failures.
    }
  }

  return history;
}

export function deleteAllHistory(): HistoryData {
  if (canUseLocalStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  return createEmptyHistory();
}

export function getStats(history: HistoryData | HistorySession[]): HistoryStats {
  const sessions = normalizeSessions(
    Array.isArray(history) ? history : (history as HistoryData)?.sessions
  );
  const totalPlayed = sessions.length;

  const ratedSessions = sessions.filter(
    (session) => Number.isFinite(Number(session.rating)) && Number(session.rating) > 0
  );
  const averageRating = ratedSessions.length > 0
    ? Number(
        (ratedSessions.reduce((sum, session) => sum + Number(session.rating), 0) / ratedSessions.length).toFixed(1)
      )
    : 0;

  const favoriteTokens: Record<string, number> = {};

  sessions.forEach((session) => {
    const tokenEntries = Object.values(session.tokens || {});
    tokenEntries.forEach((token) => {
      const tokenId = token?.id;
      if (!tokenId) {
        return;
      }

      favoriteTokens[tokenId] = (favoriteTokens[tokenId] || 0) + 1;
    });
  });

  return {
    totalPlayed,
    averageRating,
    favoriteTokens
  };
}

interface RawHistoryRoot {
  version: number;
  sessions: unknown[];
  stats: HistoryStats;
}

function migrateHistory(data: unknown): HistoryData {
  const parsed = normalizeHistoryRoot(data);

  if (parsed.version === CURRENT_VERSION) {
    return {
      ...parsed,
      sessions: normalizeSessions(parsed.sessions as unknown[]).slice(0, MAX_SESSIONS),
      stats: getStats({ ...parsed, sessions: normalizeSessions(parsed.sessions as unknown[]) } as HistoryData)
    };
  }

  let migrated: RawHistoryRoot = parsed;

  while (migrated.version < CURRENT_VERSION) {
    if (migrated.version === 0) {
      migrated = migrateV0ToV1(migrated);
      continue;
    }

    migrated = {
      ...createEmptyHistory(),
      sessions: normalizeSessions(migrated.sessions)
    };
    break;
  }

  if (migrated.version > CURRENT_VERSION) {
    migrated = {
      ...createEmptyHistory(),
      sessions: normalizeSessions(migrated.sessions)
    };
  }

  migrated.version = CURRENT_VERSION;
  const finalSessions = normalizeSessions(migrated.sessions).slice(0, MAX_SESSIONS);

  return {
    version: CURRENT_VERSION,
    sessions: finalSessions,
    stats: getStats({ version: CURRENT_VERSION, sessions: finalSessions, stats: createEmptyHistory().stats })
  };
}

function migrateV0ToV1(source: RawHistoryRoot): RawHistoryRoot {
  let sessions: unknown[] = [];
  const raw = source as unknown as Record<string, unknown>;

  if (Array.isArray(raw.sessions)) {
    sessions = raw.sessions as unknown[];
  } else if (Array.isArray(raw.history)) {
    sessions = raw.history as unknown[];
  } else if (Array.isArray(source)) {
    sessions = source;
  }

  return {
    version: 1,
    sessions: normalizeSessions(sessions),
    stats: {
      totalPlayed: 0,
      averageRating: 0,
      favoriteTokens: {}
    }
  };
}

function normalizeHistoryRoot(data: unknown): RawHistoryRoot {
  if (!data || typeof data !== 'object') {
    return createEmptyHistory();
  }

  if (Array.isArray(data)) {
    return {
      version: 0,
      sessions: data,
      stats: {
        totalPlayed: 0,
        averageRating: 0,
        favoriteTokens: {}
      }
    };
  }

  const obj = data as Record<string, unknown>;
  const version = Number.isFinite(Number(obj.version)) ? Number(obj.version) : 0;

  const rawStats = obj.stats as Record<string, unknown> | undefined;

  return {
    version,
    sessions: Array.isArray(obj.sessions) ? obj.sessions : [],
    stats: rawStats && typeof rawStats === 'object'
      ? {
          totalPlayed: Number(rawStats.totalPlayed) || 0,
          averageRating: Number(rawStats.averageRating) || 0,
          favoriteTokens: rawStats.favoriteTokens && typeof rawStats.favoriteTokens === 'object'
            ? rawStats.favoriteTokens as Record<string, number>
            : {}
        }
      : {
          totalPlayed: 0,
          averageRating: 0,
          favoriteTokens: {}
        }
  };
}

function normalizeSessions(sessions: unknown): HistorySession[] {
  if (!Array.isArray(sessions)) {
    return [];
  }

  return sessions
    .map((session) => normalizeSession(session))
    .filter((s): s is HistorySession => s !== null);
}

function normalizeSession(session: unknown): HistorySession | null {
  if (!session || typeof session !== 'object') {
    return null;
  }

  const s = session as Record<string, unknown>;
  const tokens = s.tokens as Record<string, unknown> | undefined;

  const createdAt = toIsoString(s.createdAt) || new Date().toISOString();
  const completedAt = toIsoString(s.completedAt) || createdAt;

  const red = normalizeToken(tokens?.red || (s as Record<string, unknown>).red);
  const blue = normalizeToken(tokens?.blue || (s as Record<string, unknown>).blue);
  const green = normalizeToken(tokens?.green || (s as Record<string, unknown>).green);

  const sessionTokens: Record<PouchColor, NormalizedToken | null> = {
    red,
    blue,
    green
  };

  return {
    id: String(s.id || `session-${Date.now()}`),
    createdAt,
    completedAt,
    tokens: sessionTokens,
    combinedDifficulty: Number(s.combinedDifficulty) || 0,
    worldName: String(s.worldName || '').trim(),
    userStory: String(s.userStory || '').trim(),
    rating: clampRating(s.rating)
  };
}

function normalizeToken(token: unknown): NormalizedToken | null {
  if (!token || typeof token !== 'object') {
    return null;
  }

  const t = token as Record<string, unknown>;

  return {
    id: t.id ? String(t.id) : '',
    label: t.label ? String(t.label) : '',
    emoji: t.emoji ? String(t.emoji) : ''
  };
}

function toIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value as string | number);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function clampRating(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(n)));
}

function canUseLocalStorage(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    const testKey = '__nova_pouch_history_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);

    return true;
  } catch {
    return false;
  }
}
