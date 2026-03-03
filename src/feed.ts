/* feed.ts — Community Feed (lazy-loaded) */

import { apiGet, apiPost } from './api';
import { getTokenById } from './tokens';
import presetData from './data/preset.json';
import type { FeedState, FeedRecord, PouchColor, Token } from './types';

const FEED_PAGE_SIZE = 20;
const CACHE_TTL_MS = 2 * 60 * 1000;
const LIKE_DEBOUNCE_MS = 500;
const PRESET_FEED_DATES = ['2025-04-28', '2025-04-29', '2025-04-30', '2025-04-31'] as const;

interface PresetTokenIds {
  red: string;
  blue: string;
  green: string;
}

interface PresetEntry {
  id: string;
  tokenIds: PresetTokenIds;
  prompt: string;
  worldText: string;
}

interface PresetPayload {
  version: number;
  presets: PresetEntry[];
}

interface FeedApiResponse {
  date: string;
  records: FeedRecord[];
  page: number;
  totalPages: number;
  total: number;
}

interface CacheEntry {
  data: FeedApiResponse;
  fetchedAt: number;
}

const _feedCache = new Map<string, CacheEntry>();
const _pendingLikes = new Map<string, ReturnType<typeof setTimeout>>();

let _feedState: FeedState = {
  date: null,
  records: [],
  page: 0,
  totalPages: 0,
  total: 0,
  sort: 'newest',
  isLoading: false,
  error: null,
  likedIds: new Set(),
};

const PRESET_FEED_RECORDS: FeedRecord[] = buildPresetFeedRecords();

function cacheKey(date: string, page: number, sort: string): string {
  return `${date}:${page}:${sort}`;
}

function getCachedFeed(key: string): CacheEntry['data'] | null {
  const entry = _feedCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    _feedCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedFeed(key: string, data: CacheEntry['data']): void {
  if (_feedCache.size > 20) {
    const oldest = _feedCache.keys().next().value;
    if (oldest) _feedCache.delete(oldest);
  }
  _feedCache.set(key, { data, fetchedAt: Date.now() });
}

function resolveToken(pouchType: PouchColor, id: string): Token | undefined {
  const token = getTokenById(pouchType, id);
  if (!token) return undefined;
  return {
    id: token.id,
    label: token.label,
    emoji: token.emoji,
    labelEn: token.labelEn,
  };
}

function buildPresetFeedRecords(): FeedRecord[] {
  const payload = presetData as PresetPayload;
  if (!Array.isArray(payload?.presets)) return [];

  return payload.presets
    .slice(0, PRESET_FEED_DATES.length)
    .map((preset, index) => {
      const red = resolveToken('red', preset.tokenIds.red);
      const blue = resolveToken('blue', preset.tokenIds.blue);
      const green = resolveToken('green', preset.tokenIds.green);

      // Dynamically build title from labels: Green + Blue + Red
      const comboTitle = [green?.label, blue?.label, red?.label]
        .filter(Boolean)
        .join(' ');

      return {
        id: `preset-${preset.id}`,
        date: PRESET_FEED_DATES[index],
        source: 'preset',
        tokens: { red, blue, green },
        story: preset.worldText,
        anonName: comboTitle,
        likeCount: 0,
      };
    });
}

function getPresetFeedRecords(date: string | null): FeedRecord[] {
  if (!date) return PRESET_FEED_RECORDS;
  return PRESET_FEED_RECORDS.filter(record => record.date === date);
}

function dedupeById(records: FeedRecord[]): FeedRecord[] {
  const seen = new Set<string>();
  return records.filter(record => {
    if (seen.has(record.id)) return false;
    seen.add(record.id);
    return true;
  });
}

function mergeFeedState(data: FeedApiResponse, requestedDate: string | null, page: number, sort: string): FeedState {
  const presetRecords = page === 1 ? getPresetFeedRecords(requestedDate) : [];
  const mergedRecords = page === 1
    ? [...presetRecords, ...data.records]
    : [..._feedState.records, ...data.records];

  return {
    date: requestedDate || data.date || null,
    records: dedupeById(mergedRecords),
    page: data.page,
    totalPages: data.totalPages,
    total: page === 1 ? data.total + presetRecords.length : _feedState.total,
    sort,
    isLoading: false,
    error: null,
    likedIds: _feedState.likedIds,
  };
}

function buildPresetOnlyState(requestedDate: string | null, sort: string): FeedState {
  const records = getPresetFeedRecords(requestedDate);
  return {
    date: requestedDate,
    records,
    page: records.length > 0 ? 1 : 0,
    totalPages: records.length > 0 ? 1 : 0,
    total: records.length,
    sort,
    isLoading: false,
    error: null,
    likedIds: _feedState.likedIds,
  };
}

export async function loadFeed(date?: string | null, page = 1, sort = 'newest'): Promise<FeedState> {
  const requestedDate = date || null;
  const dKey = requestedDate || 'all';
  const key = cacheKey(dKey, page, sort);
  const cached = getCachedFeed(key);
  if (cached) {
    _feedState = mergeFeedState(cached, requestedDate, page, sort);
    return _feedState;
  }

  _feedState.isLoading = true;
  _feedState.error = null;

  try {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(FEED_PAGE_SIZE),
      sort,
    };
    if (requestedDate) params.date = requestedDate;

    const data = await apiGet('/records', params, 15000) as FeedApiResponse;
    _feedState = mergeFeedState(data, requestedDate, page, sort);
    setCachedFeed(key, data);
    return _feedState;
  } catch (err) {
    if (page === 1) {
      const presetOnly = buildPresetOnlyState(requestedDate, sort);
      if (presetOnly.records.length > 0) {
        _feedState = presetOnly;
        return _feedState;
      }
    }

    _feedState.isLoading = false;
    _feedState.error = (err as Error).message || 'Failed to load feed';
    return _feedState;
  }
}

export async function loadMoreFeed(): Promise<FeedState> {
  if (_feedState.page >= _feedState.totalPages) return _feedState;
  return loadFeed(_feedState.date!, _feedState.page + 1, _feedState.sort);
}

export async function submitRecord(payload: { date: string; tokens: unknown; story: string; anonName?: string }): Promise<unknown> {
  return apiPost('/records', payload);
}

export async function fetchRecord(id: string): Promise<FeedRecord> {
  const presetRecord = PRESET_FEED_RECORDS.find(record => record.id === id);
  if (presetRecord) return presetRecord;
  return apiGet(`/records/${id}`) as Promise<FeedRecord>;
}

export function toggleLike(recordId: string, buttonEl: HTMLElement | null): void {
  if (recordId.startsWith('preset-')) return;

  const isLiked = _feedState.likedIds.has(recordId);
  const newLiked = !isLiked;

  // Optimistic UI
  if (newLiked) _feedState.likedIds.add(recordId);
  else _feedState.likedIds.delete(recordId);

  const countEl = buttonEl?.querySelector('.like-count');
  const currentCount = parseInt(countEl?.textContent || '0', 10) || 0;
  if (countEl) countEl.textContent = String(Math.max(0, currentCount + (newLiked ? 1 : -1)));
  if (buttonEl) buttonEl.classList.toggle('is-liked', newLiked);

  // Cancel previous pending
  if (_pendingLikes.has(recordId)) clearTimeout(_pendingLikes.get(recordId)!);

  const timeoutId = setTimeout(async () => {
    _pendingLikes.delete(recordId);
    try {
      const result = await apiPost(`/records/${recordId}/like`, {}) as { liked: boolean; likeCount: number };
      if (result.liked) _feedState.likedIds.add(recordId);
      else _feedState.likedIds.delete(recordId);
      if (countEl) countEl.textContent = String(result.likeCount);
      if (buttonEl) buttonEl.classList.toggle('is-liked', result.liked);
    } catch {
      // Revert
      if (isLiked) _feedState.likedIds.add(recordId);
      else _feedState.likedIds.delete(recordId);
      if (countEl) countEl.textContent = String(currentCount);
      if (buttonEl) buttonEl.classList.toggle('is-liked', isLiked);
    }
  }, LIKE_DEBOUNCE_MS);

  _pendingLikes.set(recordId, timeoutId);
}

export function getFeedState(): FeedState {
  return _feedState;
}

export function resetFeed(): void {
  _feedState = {
    date: null,
    records: [],
    page: 0,
    totalPages: 0,
    total: 0,
    sort: 'newest',
    isLoading: false,
    error: null,
    likedIds: new Set(),
  };
}
