/* feed.ts — Community Feed (lazy-loaded) */

import { apiGet, apiPost } from './api';
import type { FeedState, FeedRecord } from './types';

const FEED_PAGE_SIZE = 20;
const CACHE_TTL_MS = 2 * 60 * 1000;
const LIKE_DEBOUNCE_MS = 500;

interface CacheEntry {
  data: { records: unknown[]; page: number; totalPages: number; total: number };
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

export async function loadFeed(date?: string | null, page = 1, sort = 'newest'): Promise<FeedState> {
  const dKey = date || 'all';
  const key = cacheKey(dKey, page, sort);
  const cached = getCachedFeed(key);
  if (cached) {
    _feedState = { ..._feedState, ...cached, date: date || null, sort, isLoading: false, error: null } as FeedState;
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
    if (date) params.date = date;

    const data = await apiGet('/records', params, 15000) as { date: string; records: FeedState['records']; page: number; totalPages: number; total: number };

    const result: FeedState = {
      date: data.date,
      records: page === 1 ? data.records : [..._feedState.records, ...data.records],
      page: data.page,
      totalPages: data.totalPages,
      total: data.total,
      sort,
      isLoading: false,
      error: null,
      likedIds: _feedState.likedIds,
    };
    _feedState = result;
    setCachedFeed(key, {
      records: data.records,
      page: data.page,
      totalPages: data.totalPages,
      total: data.total,
    });
    return _feedState;
  } catch (err) {
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
  return apiGet(`/records/${id}`) as Promise<FeedRecord>;
}

export function toggleLike(recordId: string, buttonEl: HTMLElement | null): void {
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
