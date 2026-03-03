export const STORAGE_KEY = 'nova-pouch-history';
export const MAX_SESSIONS = 100;
const CURRENT_VERSION = 1;

export function createEmptyHistory() {
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

export function loadHistory() {
  if (!canUseLocalStorage()) {
    return createEmptyHistory();
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptyHistory();
  }

  let parsed;

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

export function saveSession(session) {
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

export function deleteAllHistory() {
  if (canUseLocalStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  return createEmptyHistory();
}

export function getStats(history) {
  const sessions = normalizeSessions(Array.isArray(history) ? history : history?.sessions);
  const totalPlayed = sessions.length;

  const ratedSessions = sessions.filter((session) => Number.isFinite(Number(session.rating)) && Number(session.rating) > 0);
  const averageRating = ratedSessions.length > 0
    ? Number((ratedSessions.reduce((sum, session) => sum + Number(session.rating), 0) / ratedSessions.length).toFixed(1))
    : 0;

  const favoriteTokens = {};

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

function migrateHistory(data) {
  const parsed = normalizeHistoryRoot(data);

  if (parsed.version === CURRENT_VERSION) {
    return {
      ...parsed,
      sessions: normalizeSessions(parsed.sessions).slice(0, MAX_SESSIONS),
      stats: getStats(parsed)
    };
  }

  let migrated = parsed;

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
  migrated.sessions = normalizeSessions(migrated.sessions).slice(0, MAX_SESSIONS);
  migrated.stats = getStats(migrated);

  return migrated;
}

function migrateV0ToV1(source) {
  let sessions = [];

  if (Array.isArray(source.sessions)) {
    sessions = source.sessions;
  } else if (Array.isArray(source.history)) {
    sessions = source.history;
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

function normalizeHistoryRoot(data) {
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

  const version = Number.isFinite(Number(data.version)) ? Number(data.version) : 0;

  return {
    version,
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    stats: data.stats && typeof data.stats === 'object'
      ? {
          totalPlayed: Number(data.stats.totalPlayed) || 0,
          averageRating: Number(data.stats.averageRating) || 0,
          favoriteTokens: data.stats.favoriteTokens && typeof data.stats.favoriteTokens === 'object'
            ? data.stats.favoriteTokens
            : {}
        }
      : {
          totalPlayed: 0,
          averageRating: 0,
          favoriteTokens: {}
        }
  };
}

function normalizeSessions(sessions) {
  if (!Array.isArray(sessions)) {
    return [];
  }

  return sessions
    .map((session) => normalizeSession(session))
    .filter(Boolean);
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  const createdAt = toIsoString(session.createdAt) || new Date().toISOString();
  const completedAt = toIsoString(session.completedAt) || createdAt;

  const red = normalizeToken(session.tokens?.red || session.red);
  const blue = normalizeToken(session.tokens?.blue || session.blue);
  const green = normalizeToken(session.tokens?.green || session.green);

  const tokens = {
    red,
    blue,
    green
  };

  return {
    id: String(session.id || `session-${Date.now()}`),
    createdAt,
    completedAt,
    tokens,
    combinedDifficulty: Number(session.combinedDifficulty) || 0,
    worldName: String(session.worldName || '').trim(),
    userStory: String(session.userStory || '').trim(),
    rating: clampRating(session.rating)
  };
}

function normalizeToken(token) {
  if (!token || typeof token !== 'object') {
    return null;
  }

  return {
    id: token.id ? String(token.id) : '',
    label: token.label ? String(token.label) : '',
    emoji: token.emoji ? String(token.emoji) : ''
  };
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function clampRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Math.round(n)));
}

function canUseLocalStorage() {
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
