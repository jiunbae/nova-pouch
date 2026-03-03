/* ============================================================
   types.ts — Shared Type Definitions
   ============================================================ */

// ── Locale ──────────────────────────────────────────────────
export type Locale = 'ko' | 'en';

// ── Pouch / Color ───────────────────────────────────────────
export type PouchColor = 'red' | 'blue' | 'green';

// ── Tokens ──────────────────────────────────────────────────

/** Full token from TOKEN_REGISTRY (includes difficulty + tags). */
export interface RegistryToken {
  id: string;
  label: string;
  labelEn: string;
  emoji: string;
  difficulty: number;
  tags: string[];
}

/** Common superset used across the app (optional fields cover both shapes). */
export interface Token {
  id: string;
  label: string;
  emoji: string;
  labelEn?: string;
  difficulty?: number;
  tags?: string[];
}

export type DrawnTokens = Record<PouchColor, Token | null>;

// ── Token Registry ──────────────────────────────────────────
export interface PouchData {
  name: string;
  lore: string;
  color: string;
  tokens: RegistryToken[];
}

export interface TokenRegistry {
  version: number;
  pouches: Record<PouchColor, PouchData>;
}

// ── Difficulty ──────────────────────────────────────────────
export interface DifficultyResult {
  sum: number;
  stars: number;
  label: string;
}

// ── Game State ──────────────────────────────────────────────

export type Phase = 'IDLE' | 'DRAWING' | 'REVIEW' | 'WRITING' | 'COMPLETE' | 'HISTORY';
export type GameMode = 'daily' | 'free';

export interface GameStateSnapshot {
  phase: Phase;
  currentPouch: PouchColor | null;
  drawnTokens: DrawnTokens;
  confirmedPouches: Record<PouchColor, boolean>;
  redraws: Record<PouchColor, number>;
  lastDrawn: DrawnTokens;
  worldName: string;
  userStory: string;
  rating: number;
  isAnimating: boolean;
  _prevPhase: Phase | null;
  dailyTokens: DrawnTokens;
  gameMode: GameMode;
  recordId: string | null;
  createdAt?: string;
}

export type ActionType =
  | 'START_GAME'
  | 'DRAW_TOKEN'
  | 'CONFIRM_TOKEN'
  | 'REDRAW_TOKEN'
  | 'START_WRITING'
  | 'BACK_TO_REVIEW'
  | 'UPDATE_WORLD_NAME'
  | 'UPDATE_STORY'
  | 'COMPLETE'
  | 'SET_RATING'
  | 'RESTART'
  | 'RETRY'
  | 'VIEW_HISTORY'
  | 'CLOSE_HISTORY'
  | 'BACK_HOME'
  | 'SET_ANIMATING'
  | 'GO_BACK'
  | 'SET_DAILY_TOKENS'
  | 'SET_GAME_MODE'
  | 'SUBMIT_RECORD'
  | 'VIEW_RECORD_DETAIL';

export type StateListener = (state: GameStateSnapshot, action: string, payload: unknown) => void;

export interface GameStateInstance {
  getState(): GameStateSnapshot;
  subscribe(listener: StateListener): () => void;
  dispatch(action: string, payload?: unknown): void;
}

// ── History ─────────────────────────────────────────────────

export interface NormalizedToken {
  id: string;
  label: string;
  emoji: string;
}

export interface HistorySession {
  id: string;
  createdAt: string;
  completedAt: string;
  tokens: Record<PouchColor, NormalizedToken | null>;
  combinedDifficulty: number;
  worldName: string;
  userStory: string;
  rating: number;
}

export interface HistoryStats {
  totalPlayed: number;
  averageRating: number;
  favoriteTokens: Record<string, number>;
}

export interface HistoryData {
  version: number;
  sessions: HistorySession[];
  stats: HistoryStats;
}

// ── Daily ───────────────────────────────────────────────────

export interface DailyResult {
  tokens: Record<PouchColor, RegistryToken>;
  date: string;
  source: 'cache' | 'local' | 'api';
  dayNumber: number;
}

export interface DailyCompletion {
  date: string;
  dayNumber: number;
  sessionId: string;
  completedAt: string;
  tokens: Record<string, unknown>;
  story: string;
  rating: number;
}

// ── Feed ────────────────────────────────────────────────────

export interface FeedRecord {
  id: string;
  tokens: Partial<Record<PouchColor, Token>>;
  story: string;
  user?: { displayName?: string };
  anonName?: string;
  likeCount: number;
  date?: string;
  source?: 'api' | 'preset';
}

export interface FeedState {
  date: string | null;
  records: FeedRecord[];
  page: number;
  totalPages: number;
  total: number;
  sort: string;
  isLoading: boolean;
  error: string | null;
  likedIds: Set<string>;
}

// ── Share ────────────────────────────────────────────────────

export interface ShareCardData {
  red?: Token | null;
  blue?: Token | null;
  green?: Token | null;
  story: string;
  date: string;
  locale: Locale;
}
