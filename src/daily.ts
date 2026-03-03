/* daily.ts — Daily Token Fetch + Cache + Fallback Hash */

import { getTokensByPouch } from './tokens';
import type { RegistryToken, DailyResult, DailyCompletion, PouchColor } from './types';

const DAILY_COMPLETION_KEY = 'nova-pouch-daily-completion';
/** Epoch: 김초엽 《양면의 조개껍데기》 초판1쇄 발매일 (KST midnight) */
const LAUNCH_DATE = new Date('2025-08-26T15:00:00Z'); // 2025-08-27 00:00 KST
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

let _dailyTokens: Record<PouchColor, RegistryToken> | null = null;
let _dailyDate: string | null = null;
let _source: 'cache' | 'local' | 'api' | null = null;

/** Port of server hashWithPrime(). Must match exactly. */
function hashWithPrime(input: string, prime: number): number {
  let hash = 0;
  for (const char of input) {
    hash = (hash + char.charCodeAt(0) * prime) % 2_147_483_647;
  }
  return hash;
}

/** Compute daily tokens deterministically (same as server). */
export function computeDailyTokens(dateStr?: string): Record<PouchColor, RegistryToken> {
  const d = dateStr || todayDateString();
  const redPool   = getTokensByPouch('red');
  const bluePool  = getTokensByPouch('blue');
  const greenPool = getTokensByPouch('green');
  return {
    red:   redPool[hashWithPrime(`${d}:red`, 31)     % redPool.length],
    blue:  bluePool[hashWithPrime(`${d}:blue`, 37)   % bluePool.length],
    green: greenPool[hashWithPrime(`${d}:green`, 41) % greenPool.length],
  };
}

/** Today's date as 'YYYY-MM-DD' in KST (UTC+9). */
export function todayDateString(): string {
  const now = new Date(Date.now() + KST_OFFSET_MS);
  return now.toISOString().slice(0, 10);
}

export function getDailyNumber(dateStr?: string): number {
  const d = dateStr || todayDateString();
  // Convert date string to KST midnight (same reference frame as LAUNCH_DATE)
  const target = new Date(`${d}T00:00:00+09:00`);
  return Math.floor((target.getTime() - LAUNCH_DATE.getTime()) / 86_400_000) + 1;
}

// --- Background refresh & sessionStorage cache ---
// Disabled: server still uses old 15-token pool.
// Local computation from the unified 50-token registry is authoritative.
// Re-enable once server token pool is updated to match.

/** Get daily tokens synchronously. Always computes from local registry. */
export function getDailyTokens(): DailyResult {
  const urlParams = new URLSearchParams(window.location.search);
  const paramDate = urlParams.get('date');
  const targetDate = paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate) ? paramDate : todayDateString();

  if (_dailyTokens && _dailyDate === targetDate) {
    return {
      tokens: _dailyTokens,
      date: _dailyDate,
      source: _source!,
      dayNumber: getDailyNumber(_dailyDate),
    };
  }

  _dailyTokens = computeDailyTokens(targetDate);
  _dailyDate = targetDate;
  _source = 'local';
  return {
    tokens: _dailyTokens,
    date: _dailyDate,
    source: _source,
    dayNumber: getDailyNumber(_dailyDate),
  };
}

/** Get a single daily token for a specific pouch color. */
export function getDailyToken(pouchType: PouchColor): RegistryToken {
  const { tokens } = getDailyTokens();
  return tokens[pouchType];
}

/** Non-blocking prefetch. Call in bootstrap(). */
export function prefetchDailyTokens(): void {
  getDailyTokens();
}

export function isDailyComplete(dateStr?: string): boolean {
  const d = dateStr || getDailyTokens().date;
  try {
    const raw = localStorage.getItem(DAILY_COMPLETION_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as { date: string; completedAt?: string };
    return data.date === d && !!data.completedAt;
  } catch {
    return false;
  }
}

export function getDailyCompletion(dateStr?: string): DailyCompletion | null {
  const d = dateStr || getDailyTokens().date;
  try {
    const raw = localStorage.getItem(DAILY_COMPLETION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DailyCompletion;
    if (data.date !== d) return null;
    return data;
  } catch {
    return null;
  }
}

export function markDailyComplete(sessionData: { id?: string; tokens?: Record<string, unknown>; story?: string; rating?: number } = {}): DailyCompletion {
  const targetDate = getDailyTokens().date;
  const completion: DailyCompletion = {
    date: targetDate,
    dayNumber: getDailyNumber(targetDate),
    sessionId: sessionData.id || `session-${Date.now()}`,
    completedAt: new Date().toISOString(),
    tokens: sessionData.tokens || {},
    story: (sessionData.story || '').slice(0, 500),
    rating: sessionData.rating || 0,
  };
  try {
    localStorage.setItem(DAILY_COMPLETION_KEY, JSON.stringify(completion));
  } catch {
    // ignore storage failures
  }
  return completion;
}
