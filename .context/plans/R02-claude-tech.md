# R02 Technical Implementation Plan: Frontend-Backend Integration

> Nova Pouch frontend-backend integration architecture.
> Covers: Daily Token API, Community Feed, Image Generation, Social Sharing.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [New Modules](#2-new-modules)
3. [Feature 1: Daily Token Integration](#3-feature-1-daily-token-integration)
4. [Feature 2: Community Feed](#4-feature-2-community-feed)
5. [Feature 3: Image Generation](#5-feature-3-image-generation)
6. [Feature 4: Social Sharing](#6-feature-4-social-sharing)
7. [State Machine Changes (Consolidated)](#7-state-machine-changes-consolidated)
8. [HTML Changes](#8-html-changes)
9. [i18n Additions](#9-i18n-additions)
10. [Migration & Compatibility](#10-migration--compatibility)
11. [Implementation Order](#11-implementation-order)

---

## 1. Architecture Overview

### Current Module Dependency Graph

```
app.js (entry)
  +-- state.js        (singleton GameState, PHASES, ACTIONS)
  +-- renderer.js      (DOM rendering per phase)
  +-- tokens.js        (TOKEN_REGISTRY, getRandomToken, formatCombo)
  +-- pouch.js         (draw interaction, animation, dispatches DRAW_TOKEN)
  +-- history.js       (localStorage CRUD)
  +-- i18n.js          (ko/en string table)
  +-- utils.js         (weightedPick, formatDate, debounce, etc.)
```

### Proposed Module Dependency Graph (After Integration)

```
app.js (entry)
  +-- state.js         (EXTENDED: new PHASES + ACTIONS)
  +-- renderer.js      (EXTENDED: feed overlay, share panel rendering)
  +-- tokens.js        (EXTENDED: lookupTokenById, daily token registry)
  +-- pouch.js         (MODIFIED: reads daily tokens instead of random)
  +-- history.js       (unchanged)
  +-- i18n.js          (EXTENDED: new string keys)
  +-- utils.js         (EXTENDED: hashWithPrime)
  +-- api.js           (NEW: HTTP client for all backend calls)
  +-- daily.js         (NEW: daily token fetch, cache, fallback hash)
  +-- feed.js          (NEW: community feed logic, like toggle)
  +-- share.js         (NEW: image gen, social sharing, download)
```

### Backend API Surface (jiun-api)

Base URL: `/nova-pouch` (mounted at `app.route('/nova-pouch', novaPouchRoutes)`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/nova-pouch/daily` | Today's date + 3 daily tokens |
| `GET` | `/nova-pouch/records?date=&page=&limit=&sort=` | Paginated community records |
| `GET` | `/nova-pouch/records/:id` | Single record detail |
| `POST` | `/nova-pouch/records` | Submit a new record |
| `POST` | `/nova-pouch/records/:id/like` | Toggle like on a record |
| `GET` | `/nova-pouch/records/me` | Authenticated user's records |

---

## 2. New Modules

### 2.1 `js/api.js` -- HTTP Client

Low-level fetch wrapper. All backend communication goes through this single module.

```js
/* js/api.js -- API Client */

const API_BASE = 'https://api.jiun.xyz/nova-pouch';  // configurable

/**
 * Generic GET request.
 * @param {string} path - e.g. '/daily'
 * @param {Record<string, string>} [params] - query params
 * @returns {Promise<any>} parsed JSON
 * @throws {ApiError}
 */
export async function apiGet(path, params = {}) { ... }

/**
 * Generic POST request.
 * @param {string} path - e.g. '/records'
 * @param {any} body - JSON body
 * @returns {Promise<any>} parsed JSON
 * @throws {ApiError}
 */
export async function apiPost(path, body) { ... }

/**
 * Error class with status code.
 */
export class ApiError extends Error {
  constructor(status, message, data = null) { ... }
}
```

Implementation details:
- Uses `fetch()` with `credentials: 'include'` for cookie-based anon fingerprint.
- Sends `Content-Type: application/json` on POST.
- Reads `x-anon-fingerprint` from localStorage and sends as header if present.
- Returns parsed JSON on 2xx, throws `ApiError` on 4xx/5xx.
- 15-second timeout via `AbortController`.

### 2.2 `js/daily.js` -- Daily Token Manager

Bridges between the API daily tokens and the existing TOKEN_REGISTRY. Handles fetch, cache, and offline fallback.

```js
/* js/daily.js -- Daily Token Fetch + Fallback */

import { apiGet } from './api.js';
import { TOKEN_REGISTRY } from './tokens.js';

/**
 * @typedef {Object} DailyTokenSet
 * @property {string} date - 'YYYY-MM-DD'
 * @property {{ red: Token, blue: Token, green: Token }} tokens
 * @property {'api'|'fallback'} source
 */

/** In-memory + sessionStorage cache */
let _cached = null;

/**
 * Fetch today's daily tokens from API with fallback.
 * Caches in sessionStorage keyed by date.
 * @returns {Promise<DailyTokenSet>}
 */
export async function fetchDailyTokens() { ... }

/**
 * Get cached daily tokens synchronously (null if not fetched yet).
 * @returns {DailyTokenSet|null}
 */
export function getCachedDaily() { ... }

/**
 * Client-side fallback: replicate server's hashWithPrime algorithm.
 * Must produce identical results to novaPouch.service.ts hashWithPrime.
 * @param {string} input
 * @param {number} prime
 * @returns {number}
 */
export function hashWithPrime(input, prime) { ... }

/**
 * Generate daily tokens locally using the same algorithm as the server.
 * Uses TOKEN_REGISTRY pools (not server pools -- see note below).
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {{ red: Token, blue: Token, green: Token }}
 */
export function generateFallbackTokens(dateStr) { ... }

/**
 * Get a token for a specific pouch for the daily challenge.
 * Used by pouch.js during draw sequence.
 * @param {'red'|'blue'|'green'} pouchType
 * @returns {Token}
 */
export function getDailyToken(pouchType) { ... }
```

### 2.3 `js/feed.js` -- Community Feed

Manages feed data fetching, pagination state, and like toggling.

```js
/* js/feed.js -- Community Feed Module */

import { apiGet, apiPost } from './api.js';

/**
 * @typedef {Object} FeedState
 * @property {string} date
 * @property {Array<RecordView>} records
 * @property {number} page
 * @property {number} totalPages
 * @property {number} total
 * @property {'newest'|'likes'} sort
 * @property {boolean} isLoading
 * @property {string|null} error
 * @property {Set<string>} likedIds - locally tracked liked record IDs
 */

/** Module-level feed state */
let _feedState = createEmptyFeedState();

/**
 * Initialize feed for a given date. Fetches page 1.
 * @param {string} date - 'YYYY-MM-DD'
 * @param {'newest'|'likes'} [sort='newest']
 * @returns {Promise<FeedState>}
 */
export async function initFeed(date, sort = 'newest') { ... }

/**
 * Load next page of records (append to existing).
 * @returns {Promise<FeedState>}
 */
export async function loadNextPage() { ... }

/**
 * Change sort order and reload from page 1.
 * @param {'newest'|'likes'} sort
 * @returns {Promise<FeedState>}
 */
export async function changeFeedSort(sort) { ... }

/**
 * Toggle like on a record. Updates local state optimistically.
 * @param {string} recordId
 * @returns {Promise<{ liked: boolean, likeCount: number }>}
 */
export async function toggleRecordLike(recordId) { ... }

/**
 * Submit the current session as a community record.
 * @param {{ date: string, tokens: DailyTokens, story: string, anonName?: string }} input
 * @returns {Promise<RecordView>}
 */
export async function submitRecord(input) { ... }

/**
 * Get current feed state (read-only snapshot).
 * @returns {FeedState}
 */
export function getFeedState() { ... }
```

### 2.4 `js/share.js` -- Image Generation + Social Sharing

Handles canvas rendering, blob export, Twitter intent, navigator.share, and download.

```js
/* js/share.js -- Image Generation & Social Sharing */

/**
 * Generate a shareable PNG image from the current record.
 * @param {Object} options
 * @param {Object} options.tokens - { red, blue, green } token objects
 * @param {string} options.story - user's story text
 * @param {string} options.date - 'YYYY-MM-DD'
 * @param {string} options.combo - formatted combo text
 * @param {string} [options.locale='ko']
 * @returns {Promise<Blob>} PNG blob
 */
export async function generateRecordImage(options) { ... }

/**
 * Download a blob as a file.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) { ... }

/**
 * Open Twitter/X share intent in new window.
 * @param {Object} options
 * @param {string} options.text - tweet text
 * @param {string} options.url - link URL
 */
export function shareToTwitter(options) { ... }

/**
 * Use navigator.share if available (mobile).
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.text
 * @param {string} [options.url]
 * @param {File[]} [options.files]
 * @returns {Promise<boolean>} true if shared successfully
 */
export async function nativeShare(options) { ... }

/**
 * Build a date-specific URL for sharing.
 * @param {string} date - 'YYYY-MM-DD'
 * @param {string} [recordId] - optional specific record
 * @returns {string}
 */
export function buildShareUrl(date, recordId) { ... }

/**
 * Copy text to clipboard with fallback.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) { ... }
```

---

## 3. Feature 1: Daily Token Integration

### 3.1 Data Flow

```
User clicks "Start" (IDLE -> DRAWING)
         |
         v
    [daily.js] fetchDailyTokens()
         |
    +----+----+
    |         |
  (API OK)  (API Fail / Offline)
    |         |
    v         v
  Cache    hashWithPrime fallback
  tokens   using TOKEN_REGISTRY
    |         |
    +----+----+
         |
         v
    Store in state.dailyTokens
         |
         v
    User taps pouch (pouch.js)
         |
         v
    getDailyToken(pouchType)  <-- reads from cached daily
         |
         v
    Display token (same animation as before)
```

### 3.2 Critical: hashWithPrime Parity

The server's algorithm (from `novaPouch.service.ts` line 82-88):

```typescript
function hashWithPrime(input: string, prime: number): number {
  let hash = 0;
  for (const char of input) {
    hash = (hash + char.charCodeAt(0) * prime) % 2_147_483_647;
  }
  return hash;
}
```

The client-side JS replica in `js/daily.js`:

```js
export function hashWithPrime(input, prime) {
  let hash = 0;
  for (const char of input) {
    hash = (hash + char.charCodeAt(0) * prime) % 2147483647;
  }
  return hash;
}
```

This is a direct port. JavaScript's `charCodeAt` returns UTF-16 code units; TypeScript's `for...of` iterates Unicode code points. For ASCII-only inputs like `"2026-03-03:red"`, they produce identical results. The server's token selection:

```typescript
RED_TOKENS[hashWithPrime(`${date}:red`, 31) % RED_TOKENS.length]
```

**Token pool mismatch problem**: The server uses its own `RED_TOKENS`, `BLUE_TOKENS`, `GREEN_TOKENS` arrays (10 tokens each), which are different from the client's `TOKEN_REGISTRY` (20 tokens per pouch, different IDs). The fallback must use the **same** token pools as the server. Solutions (choose one):

**Option A (Recommended)**: Embed the server's token pools in `daily.js` as a constant. Small duplication but guarantees parity.

**Option B**: Align both sides to use `TOKEN_REGISTRY` -- requires backend migration, more disruptive.

**Option C**: The fallback returns a "generic" daily set from TOKEN_REGISTRY and the user simply cannot submit to the community feed if offline.

**Recommendation**: Option A. The server's pools are small (30 tokens total). Embed them client-side for deterministic fallback. Add a `DAILY_POOLS` constant:

```js
// js/daily.js
const DAILY_POOLS = {
  red: [
    { id: 'red-door', label: '문', emoji: '🚪', labelEn: 'Door' },
    { id: 'red-key', label: '열쇠', emoji: '🗝️', labelEn: 'Key' },
    // ... all 10 from server
  ],
  blue: [ /* 10 from server */ ],
  green: [ /* 10 from server */ ],
};
```

### 3.3 File-by-File Changes

#### `js/tokens.js` -- Additions

Add a utility function for looking up tokens by ID across all registries:

```js
// ADD after line 147 (after getRandomToken function)

/**
 * Look up a token by its ID across TOKEN_REGISTRY and daily pools.
 * Returns the full token object with all metadata (emoji, labelEn, difficulty, tags).
 * @param {string} tokenId - e.g. 'red-001' or 'red-door'
 * @returns {Object|null} Token object or null
 */
export function lookupTokenById(tokenId) {
  if (!tokenId) return null;
  const color = tokenId.split('-')[0];
  const pouch = TOKEN_REGISTRY.pouches[color];
  if (pouch) {
    const found = pouch.tokens.find(t => t.id === tokenId);
    if (found) return found;
  }
  return null;
}
```

`formatCombo` and `calculateDifficulty` remain unchanged -- they already accept arbitrary token objects with `{label, labelEn}` fields.

#### `js/pouch.js` -- Modifications

**Current behavior** (line 165):
```js
const token = getRandomToken(pouchType, excludeId ?? fallbackExclude);
```

**New behavior**: Replace random selection with daily token lookup.

```js
// CHANGE in runDrawSequence (around line 148-181)

async function runDrawSequence({ gameState, pouchEl, pouchType, liveRegion, excludeId = null, isRedraw = false }) {
  if (localAnimating) return;
  const state = readState(gameState);
  if (state?.isAnimating) return;

  localAnimating = true;
  setAnimating(gameState, true);

  try {
    await animateClass(pouchEl, 'pouch--shaking', getDuration(SHAKE_MS));

    // --- CHANGED: use daily token instead of random ---
    let token;
    if (isRedraw) {
      // Redraw: still use random from TOKEN_REGISTRY (daily = fixed, so redraw picks random)
      const fallbackExclude = state?.lastDrawn?.[pouchType]?.id ?? null;
      token = getRandomToken(pouchType, excludeId ?? fallbackExclude);
    } else {
      // First draw: use the daily token
      token = getDailyToken(pouchType);
    }
    // --- END CHANGED ---

    const tokenSlot = document.getElementById(`step-token-${pouchType}`);
    await animateClass(tokenSlot, 'token-rise', getDuration(RISE_MS));
    await animateClass(tokenSlot, 'token-flip', getDuration(FLIP_MS));

    revealToken(pouchType, token, liveRegion);
    if (isRedraw) {
      dispatchAction(gameState, 'REDRAW_TOKEN', { pouch: pouchType, token });
    } else {
      dispatchAction(gameState, 'DRAW_TOKEN', { pouch: pouchType, token });
    }
  } finally {
    setAnimating(gameState, false);
    localAnimating = false;
  }
}
```

New import at top of `pouch.js`:
```js
// CHANGE line 1: add getDailyToken import
import { getRandomToken } from './tokens.js';
import { getDailyToken } from './daily.js';
```

**Design decision on redraws**: When the daily combination is fixed, a "redraw" gives the user a random alternative from TOKEN_REGISTRY (the full 20-token pool). This preserves the redraw mechanic while keeping the daily base combination deterministic. The user's final submitted combination will differ from daily if they use a redraw, and the backend's `tokensMatch` check will reject it for community submission. Two options:

- **Option A**: Disable redraw entirely in daily mode (simplest, cleanest for community).
- **Option B**: Allow redraw but flag the session as "custom" (cannot submit to community feed).

Recommendation: **Option A** for MVP. Disable redraw buttons when playing the daily challenge. The daily tokens are the daily tokens.

#### `js/state.js` -- Additions

```js
// EXTEND createInitialState() -- add fields after line 91:

    dailyTokens: null,    // { red: Token, blue: Token, green: Token } | null
    dailyDate: null,      // 'YYYY-MM-DD' | null
    isDailyMode: false,   // true when playing the daily challenge
    isLoadingDaily: false, // true while fetching from API
```

New action in `ACTIONS` (add after `GO_BACK`):
```js
  SET_DAILY_TOKENS: 'SET_DAILY_TOKENS',
  SET_LOADING_DAILY: 'SET_LOADING_DAILY',
```

New reducer cases (add before `default` in `_reduce`):
```js
      case ACTIONS.SET_DAILY_TOKENS: {
        const { date, tokens } = payload;
        s.dailyTokens = tokens;
        s.dailyDate = date;
        s.isDailyMode = true;
        break;
      }

      case ACTIONS.SET_LOADING_DAILY:
        s.isLoadingDaily = !!payload;
        break;
```

#### `js/app.js` -- Modifications

**Change START_GAME handler** (line 68-70):

```js
// REPLACE the start-game binding:

  bindButtons(['[data-action="start-game"]', '#btn-start'], async () => {
    dispatchAction('SET_LOADING_DAILY', true);

    try {
      const daily = await fetchDailyTokens();
      dispatchAction('SET_DAILY_TOKENS', { date: daily.date, tokens: daily.tokens });
    } catch (err) {
      console.warn('[app] Failed to fetch daily tokens, using fallback', err);
      // fetchDailyTokens already returns fallback internally, so this catch
      // is only for truly catastrophic failures
    } finally {
      dispatchAction('SET_LOADING_DAILY', false);
    }

    dispatchAction('START_GAME');
  });
```

New import at top of `app.js`:
```js
import { fetchDailyTokens } from './daily.js';
```

### 3.4 Session Storage Cache Strategy

`daily.js` caches in `sessionStorage` with key `nova-pouch-daily-{date}`:

```js
function cacheKey(date) { return `nova-pouch-daily-${date}`; }

async function fetchDailyTokens() {
  const today = todayString();

  // 1. Check memory cache
  if (_cached && _cached.date === today) return _cached;

  // 2. Check sessionStorage
  const stored = sessionStorage.getItem(cacheKey(today));
  if (stored) {
    try {
      _cached = JSON.parse(stored);
      return _cached;
    } catch { /* fall through */ }
  }

  // 3. Fetch from API
  try {
    const data = await apiGet('/daily');
    _cached = { date: data.date, tokens: data.tokens, source: 'api' };
    sessionStorage.setItem(cacheKey(data.date), JSON.stringify(_cached));
    return _cached;
  } catch {
    // 4. Fallback: local hash
    const tokens = generateFallbackTokens(today);
    _cached = { date: today, tokens, source: 'fallback' };
    return _cached;
  }
}
```

---

## 4. Feature 2: Community Feed

### 4.1 UI Approach: Overlay (like History)

The community feed uses the **same overlay pattern** as the existing History layer. This is consistent with the current architecture and avoids disrupting the step/flow rendering system.

```
index.html layers:
  #layer-idle      (IDLE phase)
  #layer-game      (DRAWING/REVIEW/WRITING/COMPLETE phases)
  #layer-history   (HISTORY overlay -- existing)
  #layer-feed      (FEED overlay -- NEW)
```

### 4.2 Data Flow

```
User clicks "Community" button (from COMPLETE or IDLE)
         |
         v
    dispatch('VIEW_FEED')
         |
         v
    state.phase = PHASES.FEED
    state._prevPhase preserved
         |
         v
    renderer.js shows #layer-feed
         |
         v
    feed.js initFeed(state.dailyDate)
         |
         v
    apiGet('/records?date=...&page=1&sort=newest')
         |
         v
    renderFeedCards(records)
         |
    +----+----+
    |         |
  [Like]   [Load More]
    |         |
    v         v
  toggleRecordLike()  loadNextPage()
```

### 4.3 State Machine Changes

New phase:
```js
// state.js PHASES:
FEED: 'FEED',
```

New actions:
```js
// state.js ACTIONS:
VIEW_FEED: 'VIEW_FEED',
CLOSE_FEED: 'CLOSE_FEED',
```

Reducer cases:
```js
      case ACTIONS.VIEW_FEED:
        s._prevPhase = s.phase;
        s.phase = PHASES.FEED;
        break;

      case ACTIONS.CLOSE_FEED:
        s.phase = s._prevPhase || PHASES.IDLE;
        s._prevPhase = null;
        break;
```

Update `GO_BACK` reducer (add at top of GO_BACK case):
```js
      case ACTIONS.GO_BACK: {
        if (s.phase === PHASES.FEED) {
          s.phase = s._prevPhase || PHASES.IDLE;
          s._prevPhase = null;
          break;
        }
        // ... existing cases
```

### 4.4 Renderer Changes

#### `js/renderer.js` -- Additions

In `cacheDOM()` (around line 40-100), add:
```js
  // Feed layer
  dom.layers.feed = document.getElementById('layer-feed');
  dom.feedList = document.getElementById('feed-list');
  dom.feedLoading = document.getElementById('feed-loading');
  dom.feedSortNewest = document.getElementById('feed-sort-newest');
  dom.feedSortLikes = document.getElementById('feed-sort-likes');
  dom.feedLoadMore = document.getElementById('feed-load-more');
  dom.feedDate = document.getElementById('feed-date');
  dom.feedEmpty = document.getElementById('feed-empty');
```

In `updateVisibility()` (around line 314-339), add feed layer handling:
```js
  // Feed overlay (same pattern as History)
  const showFeed = phase === PHASES.FEED;
  if (showFeed) {
    dom.layers.feed.classList.add('layer--active');
    dom.layers.feed.style.display = 'flex';
  } else {
    dom.layers.feed.classList.remove('layer--active');
    setTimeout(() => {
      if (!dom.layers.feed.classList.contains('layer--active')) {
        dom.layers.feed.style.display = 'none';
      }
    }, 500);
  }
```

New render function for feed cards:
```js
/**
 * Render a single feed card HTML.
 * @param {RecordView} record
 * @param {boolean} isLiked
 * @returns {string} HTML string
 */
function renderFeedCard(record, isLiked) {
  const tokens = record.tokens;
  const combo = formatSessionCombo({ tokens });
  const displayName = record.user?.displayName || record.anonName || '익명의 기록자';
  const date = formatDate(record.createdAt);
  const likeClass = isLiked ? 'feed-card__like--active' : '';
  const storyPreview = record.story.length > 200
    ? record.story.slice(0, 200) + '...'
    : record.story;

  return `
    <article class="feed-card" data-record-id="${record.id}">
      <header class="feed-card__header">
        <span class="feed-card__author">${escapeHtml(displayName)}</span>
        <time class="feed-card__date">${date}</time>
      </header>
      <p class="feed-card__combo">"${escapeHtml(combo)}"</p>
      <p class="feed-card__story">${escapeHtml(storyPreview)}</p>
      <footer class="feed-card__footer">
        <button class="feed-card__like ${likeClass}"
                data-action="toggle-like"
                data-record-id="${record.id}"
                aria-label="${t('feed.like')}"
                aria-pressed="${isLiked}">
          <span class="feed-card__like-icon">${isLiked ? '&#9829;' : '&#9825;'}</span>
          <span class="feed-card__like-count">${record.likeCount}</span>
        </button>
      </footer>
    </article>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render the entire feed list.
 * @param {FeedState} feedState
 */
export function renderFeed(feedState) {
  if (!dom.feedList) return;

  if (feedState.isLoading && feedState.records.length === 0) {
    dom.feedList.innerHTML = '<div class="feed-loading"><span class="spinner"></span></div>';
    return;
  }

  if (feedState.records.length === 0) {
    dom.feedList.innerHTML = `<p class="feed-empty">${t('feed.empty')}</p>`;
    return;
  }

  const html = feedState.records
    .map(record => renderFeedCard(record, feedState.likedIds.has(record.id)))
    .join('');
  dom.feedList.innerHTML = html;

  // Show/hide load more button
  if (dom.feedLoadMore) {
    dom.feedLoadMore.style.display =
      feedState.page < feedState.totalPages ? 'block' : 'none';
  }

  // Update date display
  if (dom.feedDate) {
    dom.feedDate.textContent = feedState.date;
  }
}
```

### 4.5 Feed Module (`js/feed.js`) -- Implementation Details

```js
// Like state persistence in localStorage
const LIKED_STORAGE_KEY = 'nova-pouch-liked-ids';

function loadLikedIds() {
  try {
    const raw = localStorage.getItem(LIKED_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveLikedIds(ids) {
  try {
    localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

export async function toggleRecordLike(recordId) {
  const likedIds = loadLikedIds();

  // Optimistic update
  const wasLiked = likedIds.has(recordId);
  if (wasLiked) {
    likedIds.delete(recordId);
  } else {
    likedIds.add(recordId);
  }
  saveLikedIds(likedIds);
  _feedState.likedIds = likedIds;

  // Update DOM immediately (optimistic)
  const card = document.querySelector(`[data-record-id="${recordId}"]`);
  if (card) {
    const likeBtn = card.querySelector('[data-action="toggle-like"]');
    const countEl = card.querySelector('.feed-card__like-count');
    const iconEl = card.querySelector('.feed-card__like-icon');
    if (likeBtn) {
      likeBtn.classList.toggle('feed-card__like--active', !wasLiked);
      likeBtn.setAttribute('aria-pressed', String(!wasLiked));
    }
    if (iconEl) iconEl.innerHTML = !wasLiked ? '&#9829;' : '&#9825;';
    if (countEl) {
      const current = parseInt(countEl.textContent, 10) || 0;
      countEl.textContent = String(current + (wasLiked ? -1 : 1));
    }
  }

  // Server sync
  try {
    const result = await apiPost(`/records/${recordId}/like`, {});
    // Reconcile with server truth
    if (result.liked !== !wasLiked) {
      // Server disagrees, revert optimistic update
      if (result.liked) likedIds.add(recordId);
      else likedIds.delete(recordId);
      saveLikedIds(likedIds);
    }
    // Update count from server
    if (countEl) countEl.textContent = String(result.likeCount);
    return result;
  } catch (err) {
    // Revert optimistic update on failure
    if (wasLiked) likedIds.add(recordId);
    else likedIds.delete(recordId);
    saveLikedIds(likedIds);
    throw err;
  }
}
```

### 4.6 Pagination Strategy

- Initial load: 20 records (API default).
- "Load More" button at bottom (no infinite scroll -- simpler, lower complexity).
- `loadNextPage()` appends to `_feedState.records` and increments `page`.
- Sort toggle (newest/likes) resets to page 1 and replaces all records.
- The feed always shows records for a specific date (today by default).

### 4.7 App.js Integration Points

In `bindAllButtons()`, add feed-related bindings:

```js
  // Community Feed -- open overlay
  bindButtons(['[data-action="view-feed"]', '#btn-feed'], async () => {
    dispatchAction('VIEW_FEED');
    const state = readState();
    const date = state?.dailyDate || todayString();
    await initFeed(date);
    renderFeed(getFeedState());
  });

  // Community Feed -- close overlay
  bindButtons(['#btn-close-feed'], () => {
    dispatchAction('CLOSE_FEED');
  });

  // Community Feed -- load more
  bindButtons(['#feed-load-more'], async () => {
    await loadNextPage();
    renderFeed(getFeedState());
  });

  // Community Feed -- sort toggle
  bindButtons(['#feed-sort-newest'], async () => {
    await changeFeedSort('newest');
    renderFeed(getFeedState());
  });

  bindButtons(['#feed-sort-likes'], async () => {
    await changeFeedSort('likes');
    renderFeed(getFeedState());
  });
```

Like button uses event delegation on `#feed-list`:

```js
  // Like toggle (event delegation)
  const feedList = document.getElementById('feed-list');
  if (feedList) {
    feedList.addEventListener('click', async (event) => {
      const likeBtn = event.target.closest('[data-action="toggle-like"]');
      if (!likeBtn) return;
      event.preventDefault();
      const recordId = likeBtn.dataset.recordId;
      if (!recordId) return;
      try {
        await toggleRecordLike(recordId);
      } catch (err) {
        announce(t('feed.likeError'));
      }
    });
  }
```

### 4.8 Record Submission (from COMPLETE phase)

In the "Complete" handler in `app.js`, after `saveSession(session)`, add community submission:

```js
  // After line 96-97 in app.js (after saveSession):

  // Submit to community feed (fire-and-forget, non-blocking)
  const dailyState = readState();
  if (dailyState?.isDailyMode && dailyState?.dailyDate) {
    submitRecord({
      date: dailyState.dailyDate,
      tokens: dailyState.dailyTokens,
      story: storyText,
    }).catch(err => {
      console.warn('[app] Failed to submit community record:', err);
      // Non-blocking: user's local history is already saved
    });
  }
```

---

## 5. Feature 3: Image Generation

### 5.1 Canvas Architecture

```
generateRecordImage(options)
         |
         v
    Create OffscreenCanvas (1200x630 -- OG image ratio)
         |
         v
    await ensureFontsLoaded()  // document.fonts.ready
         |
         v
    Draw layers:
      1. Background gradient (#0F0C29 -> #1A1B26)
      2. Decorative border / frame
      3. "NOVA POUCH" title text (Pretendard Bold)
      4. Date text
      5. Token emoji row (red, blue, green)
      6. Combo text (Nanum Myeongjo)
      7. Story excerpt (first 3 lines, max 150 chars)
      8. Footer / branding
         |
         v
    canvas.convertToBlob({ type: 'image/png' })
    OR canvas.toBlob() for regular canvas
         |
         v
    Return PNG Blob
```

### 5.2 Implementation Details

```js
// js/share.js

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 630;
const PADDING = 60;

export async function generateRecordImage(options) {
  const { tokens, story, date, combo, locale = 'ko' } = options;

  // Ensure fonts are loaded
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');

  // 1. Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, '#0F0C29');
  gradient.addColorStop(1, '#1A1B26');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Decorative frame (subtle border)
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';  // stardust gold, subtle
  ctx.lineWidth = 2;
  ctx.strokeRect(PADDING / 2, PADDING / 2, CANVAS_WIDTH - PADDING, CANVAS_HEIGHT - PADDING);

  // 3. Title
  ctx.fillStyle = '#E8E6E3';
  ctx.font = 'bold 32px Pretendard, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NOVA POUCH', CANVAS_WIDTH / 2, PADDING + 40);

  // 4. Date
  ctx.fillStyle = '#8B8B8B';
  ctx.font = '18px Pretendard, sans-serif';
  ctx.fillText(date, CANVAS_WIDTH / 2, PADDING + 70);

  // 5. Token emojis -- cross-browser emoji rendering
  const emojiY = PADDING + 130;
  const emojiSpacing = 120;
  const emojis = [
    { emoji: tokens.red?.emoji, color: '#FF4B2B' },
    { emoji: tokens.blue?.emoji, color: '#00D2FF' },
    { emoji: tokens.green?.emoji, color: '#5DFFAB' },
  ];

  emojis.forEach((item, i) => {
    const x = CANVAS_WIDTH / 2 + (i - 1) * emojiSpacing;

    // Colored circle behind emoji
    ctx.beginPath();
    ctx.arc(x, emojiY, 36, 0, Math.PI * 2);
    ctx.fillStyle = item.color + '33';  // 20% opacity
    ctx.fill();
    ctx.strokeStyle = item.color + '88';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Emoji text
    ctx.font = '40px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(item.emoji || '', x, emojiY);
  });

  // 6. Combo text
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFD700';
  ctx.font = '24px "Nanum Myeongjo", serif';
  ctx.textAlign = 'center';
  ctx.fillText(`"${combo}"`, CANVAS_WIDTH / 2, emojiY + 80);

  // 7. Story excerpt
  ctx.fillStyle = '#E8E6E3';
  ctx.font = '18px "Nanum Myeongjo", serif';
  ctx.textAlign = 'center';
  const storyLines = wrapText(ctx, story, CANVAS_WIDTH - PADDING * 4, 3);
  storyLines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_WIDTH / 2, emojiY + 130 + i * 28);
  });

  // 8. Footer
  ctx.fillStyle = '#8B8B8B';
  ctx.font = '14px Pretendard, sans-serif';
  ctx.fillText('nova-pouch.jiun.xyz', CANVAS_WIDTH / 2, CANVAS_HEIGHT - PADDING + 10);

  // Export as PNG blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/png'
    );
  });
}

/**
 * Wrap text to fit within maxWidth, returning at most maxLines lines.
 */
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.replace(/\n/g, ' ').split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = test;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  // Add ellipsis to last line if text was truncated
  if (lines.length >= maxLines && words.length > 0) {
    const lastLine = lines[lines.length - 1];
    if (ctx.measureText(lastLine + '...').width <= maxWidth) {
      lines[lines.length - 1] = lastLine + '...';
    } else {
      lines[lines.length - 1] = lastLine.slice(0, -3) + '...';
    }
  }

  return lines;
}
```

### 5.3 Emoji Rendering Cross-Browser

Canvas emoji rendering varies by platform. The approach:

1. **Primary**: Use system emoji font stack `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"`. Works on macOS/iOS (Apple Color Emoji), Windows (Segoe UI Emoji), and Android/Linux (Noto Color Emoji).

2. **Fallback for servers/headless**: If `ctx.measureText(emoji).width === 0`, the emoji cannot be rendered. In this case, draw a colored circle with the token label text instead.

3. **No external library needed** for MVP. If emoji rendering proves unreliable, a future enhancement could use [Twemoji](https://github.com/twitter/twemoji) to render emoji as images on canvas via `ctx.drawImage()`.

### 5.4 Font Loading

```js
async function ensureFontsLoaded() {
  try {
    // Wait for all declared fonts to load (timeout 3s)
    await Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);

    // Explicitly check for our required fonts
    const fontsNeeded = ['Pretendard', 'Nanum Myeongjo'];
    for (const fontFamily of fontsNeeded) {
      if (!document.fonts.check(`16px "${fontFamily}"`)) {
        console.warn(`[share] Font "${fontFamily}" not loaded, using fallback`);
      }
    }
  } catch {
    // Proceed anyway with system fonts
  }
}
```

---

## 6. Feature 4: Social Sharing

### 6.1 Share Flow Diagram

```
User on COMPLETE step clicks "Share"
         |
         v
    Show share panel (sub-section in COMPLETE)
         |
    +----+----+----+----+
    |         |         |         |
  [Copy]   [Twitter] [Download] [Native]
    |         |         |         |
    v         v         v         v
  clipboard  intent   blob.png  navigator
  .writeText URL      download  .share()
```

### 6.2 Twitter Intent URL Construction

```js
// js/share.js

export function shareToTwitter({ text, url }) {
  const params = new URLSearchParams();
  params.set('text', text);
  if (url) params.set('url', url);

  const intentUrl = `https://twitter.com/intent/tweet?${params.toString()}`;
  window.open(intentUrl, '_blank', 'width=550,height=420,noopener,noreferrer');
}
```

Tweet text construction:
```js
function buildTweetText(state) {
  const combo = formatCombo(state.drawnTokens);
  const locale = getLocale();

  if (locale === 'en') {
    return `I discovered a world where "${combo}" is everyday life.\n\n#NovaPouch`;
  }
  return `"${combo}" 가 일상인 세계를 발견했습니다.\n\n#NovaPouch #노바파우치`;
}
```

### 6.3 Download as Image File

```js
// js/share.js

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
```

Filename format: `nova-pouch-{date}.png` (e.g. `nova-pouch-2026-03-03.png`)

### 6.4 navigator.share Integration

```js
// js/share.js

export async function nativeShare({ title, text, url, files }) {
  if (!navigator.share) return false;

  try {
    const shareData = { title, text };
    if (url) shareData.url = url;

    // Share with image file if supported
    if (files && files.length > 0 && navigator.canShare?.({ files })) {
      shareData.files = files;
    }

    await navigator.share(shareData);
    return true;
  } catch (err) {
    if (err.name === 'AbortError') return false; // User cancelled
    throw err;
  }
}
```

### 6.5 URL Scheme for Date-Specific Records

```
https://nova-pouch.jiun.xyz/?date=2026-03-03
https://nova-pouch.jiun.xyz/?date=2026-03-03&record=<recordId>
```

On page load, `app.js` checks URL params:

```js
// In bootstrap() function, after initI18n():

function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const dateParam = params.get('date');
  const recordParam = params.get('record');

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    // Auto-open feed for this date
    setTimeout(async () => {
      dispatchAction('SET_LOADING_DAILY', true);
      try {
        const daily = await fetchDailyTokens(); // uses today's tokens
        dispatchAction('SET_DAILY_TOKENS', { date: daily.date, tokens: daily.tokens });
      } finally {
        dispatchAction('SET_LOADING_DAILY', false);
      }

      dispatchAction('VIEW_FEED');
      await initFeed(dateParam);
      renderFeed(getFeedState());

      // If specific record, scroll to it
      if (recordParam) {
        const card = document.querySelector(`[data-record-id="${recordParam}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }
}
```

Build share URL:
```js
export function buildShareUrl(date, recordId) {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (recordId) params.set('record', recordId);
  return `${base}?${params.toString()}`;
}
```

### 6.6 Modified Share Button in app.js

Replace existing `bindShareButton()` (lines 176-203):

```js
function bindShareButton() {
  // Main share button -- now opens a share sub-panel
  bindButtons(['[data-action="share"]', '#step-btn-share'], async (event) => {
    event.preventDefault();
    const panel = document.getElementById('share-panel');
    if (panel) {
      panel.classList.toggle('share-panel--visible');
    }
  });

  // Copy text
  bindButtons(['[data-action="share-copy"]'], async (event) => {
    event.preventDefault();
    const state = readState();
    const shareText = buildShareText(state);
    const success = await copyToClipboard(shareText);
    announce(success ? t('announce.copied') : t('announce.shareError'));
  });

  // Twitter
  bindButtons(['[data-action="share-twitter"]'], (event) => {
    event.preventDefault();
    const state = readState();
    const text = buildTweetText(state);
    const url = buildShareUrl(state.dailyDate);
    shareToTwitter({ text, url });
  });

  // Download image
  bindButtons(['[data-action="share-download"]'], async (event) => {
    event.preventDefault();
    const state = readState();
    const combo = formatCombo(state.drawnTokens);
    try {
      const blob = await generateRecordImage({
        tokens: state.drawnTokens,
        story: state.userStory,
        date: state.dailyDate || new Date().toISOString().slice(0, 10),
        combo,
        locale: getLocale(),
      });
      const filename = `nova-pouch-${state.dailyDate || 'record'}.png`;
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('[share] Image generation failed:', err);
      announce(t('announce.shareError'));
    }
  });

  // Native share (mobile)
  bindButtons(['[data-action="share-native"]'], async (event) => {
    event.preventDefault();
    const state = readState();
    const combo = formatCombo(state.drawnTokens);
    const text = buildShareText(state);

    try {
      const blob = await generateRecordImage({
        tokens: state.drawnTokens,
        story: state.userStory,
        date: state.dailyDate || new Date().toISOString().slice(0, 10),
        combo,
        locale: getLocale(),
      });
      const file = new File([blob], 'nova-pouch.png', { type: 'image/png' });

      const shared = await nativeShare({
        title: t('share.shareTitle'),
        text,
        url: buildShareUrl(state.dailyDate),
        files: [file],
      });

      if (!shared) {
        // Fallback to clipboard
        await copyToClipboard(text);
        announce(t('announce.copied'));
      }
    } catch {
      announce(t('announce.shareError'));
    }
  });
}
```

---

## 7. State Machine Changes (Consolidated)

### 7.1 Complete PHASES Object

```js
export const PHASES = Object.freeze({
  IDLE: 'IDLE',
  DRAWING: 'DRAWING',
  REVIEW: 'REVIEW',
  WRITING: 'WRITING',
  COMPLETE: 'COMPLETE',
  HISTORY: 'HISTORY',
  FEED: 'FEED',           // NEW
});
```

### 7.2 Complete ACTIONS Object

```js
export const ACTIONS = Object.freeze({
  // Existing
  START_GAME: 'START_GAME',
  DRAW_TOKEN: 'DRAW_TOKEN',
  CONFIRM_TOKEN: 'CONFIRM_TOKEN',
  REDRAW_TOKEN: 'REDRAW_TOKEN',
  START_WRITING: 'START_WRITING',
  BACK_TO_REVIEW: 'BACK_TO_REVIEW',
  UPDATE_WORLD_NAME: 'UPDATE_WORLD_NAME',
  UPDATE_STORY: 'UPDATE_STORY',
  COMPLETE: 'COMPLETE',
  SET_RATING: 'SET_RATING',
  RESTART: 'RESTART',
  RETRY: 'RETRY',
  VIEW_HISTORY: 'VIEW_HISTORY',
  CLOSE_HISTORY: 'CLOSE_HISTORY',
  BACK_HOME: 'BACK_HOME',
  SET_ANIMATING: 'SET_ANIMATING',
  GO_BACK: 'GO_BACK',

  // New
  SET_DAILY_TOKENS: 'SET_DAILY_TOKENS',
  SET_LOADING_DAILY: 'SET_LOADING_DAILY',
  VIEW_FEED: 'VIEW_FEED',
  CLOSE_FEED: 'CLOSE_FEED',
});
```

### 7.3 Extended Initial State

```js
function createInitialState() {
  return {
    // Existing fields
    phase: PHASES.IDLE,
    currentPouch: null,
    drawnTokens: { red: null, blue: null, green: null },
    confirmedPouches: { red: false, blue: false, green: false },
    redraws: { red: 0, blue: 0, green: 0 },
    lastDrawn: { red: null, blue: null, green: null },
    worldName: '',
    userStory: '',
    rating: 0,
    isAnimating: false,
    _prevPhase: null,

    // New fields
    dailyTokens: null,
    dailyDate: null,
    isDailyMode: false,
    isLoadingDaily: false,
  };
}
```

### 7.4 New Reducer Cases (summary)

```js
case ACTIONS.SET_DAILY_TOKENS: {
  s.dailyTokens = payload.tokens;
  s.dailyDate = payload.date;
  s.isDailyMode = true;
  break;
}

case ACTIONS.SET_LOADING_DAILY:
  s.isLoadingDaily = !!payload;
  break;

case ACTIONS.VIEW_FEED:
  s._prevPhase = s.phase;
  s.phase = PHASES.FEED;
  break;

case ACTIONS.CLOSE_FEED:
  s.phase = s._prevPhase || PHASES.IDLE;
  s._prevPhase = null;
  break;
```

Also extend `GO_BACK`:
```js
case ACTIONS.GO_BACK: {
  if (s.phase === PHASES.FEED) {
    s.phase = s._prevPhase || PHASES.IDLE;
    s._prevPhase = null;
    break;
  }
  // ... existing GO_BACK logic unchanged
}
```

Also extend `RESTART`:
```js
case ACTIONS.RESTART:
  Object.assign(s, createInitialState());
  // NOTE: createInitialState() now resets daily* fields too.
  // If we want to preserve daily tokens across restarts:
  // const { dailyTokens, dailyDate, isDailyMode } = s;
  // Object.assign(s, createInitialState());
  // s.dailyTokens = dailyTokens;
  // s.dailyDate = dailyDate;
  // s.isDailyMode = isDailyMode;
  break;
```

Recommendation: Preserve daily tokens across RESTART so the user can replay the same daily without re-fetching.

---

## 8. HTML Changes

### 8.1 New Layer: Feed Overlay

Add after `#layer-history` closing tag (after line 269 in index.html):

```html
    <!-- ========== Layer: COMMUNITY FEED (overlay) ========== -->
    <section id="layer-feed" class="layer layer--overlay" style="display:none">
      <div class="layer__inner">
        <div class="feed__header">
          <button id="btn-close-feed" class="btn btn--ghost btn--back" data-i18n="feed.back" aria-label="Close">
            ← Back
          </button>
          <h2 class="feed__title" data-i18n="feed.title">Community</h2>
          <span class="feed__date" id="feed-date"></span>
        </div>

        <div class="feed__sort">
          <button id="feed-sort-newest" class="btn btn--tab btn--tab--active" data-i18n="feed.sortNewest">Newest</button>
          <button id="feed-sort-likes" class="btn btn--tab" data-i18n="feed.sortLikes">Most Liked</button>
        </div>

        <div class="feed__list" id="feed-list">
          <p class="feed-empty" id="feed-empty" data-i18n="feed.empty">No records yet.</p>
        </div>

        <button id="feed-load-more" class="btn btn--ghost btn--full" data-i18n="feed.loadMore" style="display:none">
          Load More
        </button>
      </div>
    </section>
```

### 8.2 Share Panel in Complete Section

Replace the existing share button area in `#step-complete` (around line 228-238):

```html
              <div class="step__actions">
                <button id="step-btn-restart" class="btn btn--primary btn--full" data-i18n="complete.restart">
                  Restart
                </button>

                <!-- Share panel toggle -->
                <button id="step-btn-share" class="btn btn--secondary btn--full" data-action="share" data-i18n="complete.share">
                  Share
                </button>

                <!-- Share sub-panel (hidden by default) -->
                <div id="share-panel" class="share-panel">
                  <button class="share-panel__btn" data-action="share-copy" data-i18n="share.copy" aria-label="Copy to clipboard">
                    <span class="share-panel__icon">📋</span>
                    <span data-i18n="share.copyLabel">Copy</span>
                  </button>
                  <button class="share-panel__btn" data-action="share-twitter" data-i18n="share.twitter" aria-label="Share to Twitter">
                    <span class="share-panel__icon">𝕏</span>
                    <span>Twitter</span>
                  </button>
                  <button class="share-panel__btn" data-action="share-download" aria-label="Download image">
                    <span class="share-panel__icon">💾</span>
                    <span data-i18n="share.downloadLabel">Image</span>
                  </button>
                  <button class="share-panel__btn" data-action="share-native" aria-label="Share via system">
                    <span class="share-panel__icon">📤</span>
                    <span data-i18n="share.nativeLabel">Share</span>
                  </button>
                </div>

                <!-- Community feed button -->
                <button id="step-btn-feed" class="btn btn--ghost btn--full" data-action="view-feed" data-i18n="complete.feed">
                  Community
                </button>

                <button id="step-btn-history" class="btn btn--ghost btn--full" data-i18n="complete.history">
                  Archive
                </button>
              </div>
```

### 8.3 Feed Button on Idle Screen

Add after `#btn-history-idle` (after line 72 in index.html):

```html
        <button id="btn-feed" class="btn btn--ghost" data-action="view-feed" data-i18n="idle.feed">
          Community
        </button>
```

---

## 9. i18n Additions

### Korean Strings

```js
// feed
'feed.title':       '커뮤니티',
'feed.back':        '← 돌아가기',
'feed.empty':       '아직 기록이 없습니다.',
'feed.sortNewest':  '최신순',
'feed.sortLikes':   '좋아요순',
'feed.loadMore':    '더 보기',
'feed.like':        '좋아요',
'feed.likeError':   '좋아요 처리 중 오류가 발생했습니다.',
'feed.anonAuthor':  '익명의 기록자',

// share panel
'share.copy':        '텍스트 복사',
'share.copyLabel':   '복사',
'share.downloadLabel': '이미지',
'share.nativeLabel': '공유',
'share.tweetText':   '"{combo}" 가 일상인 세계를 발견했습니다.\n\n#NovaPouch #노바파우치',

// complete (additions)
'complete.feed':     '커뮤니티',

// idle (additions)
'idle.feed':         '커뮤니티',

// daily loading
'daily.loading':     '오늘의 파편을 불러오는 중...',
'daily.fallback':    '오프라인 모드로 실행합니다.',
```

### English Strings

```js
// feed
'feed.title':       'Community',
'feed.back':        '← Back',
'feed.empty':       'No records yet for this day.',
'feed.sortNewest':  'Newest',
'feed.sortLikes':   'Most Liked',
'feed.loadMore':    'Load More',
'feed.like':        'Like',
'feed.likeError':   'Failed to toggle like.',
'feed.anonAuthor':  'Anonymous Archivist',

// share panel
'share.copy':        'Copy text',
'share.copyLabel':   'Copy',
'share.downloadLabel': 'Image',
'share.nativeLabel': 'Share',
'share.tweetText':   'I discovered a world where "{combo}" is everyday life.\n\n#NovaPouch',

// complete (additions)
'complete.feed':     'Community',

// idle (additions)
'idle.feed':         'Community',

// daily loading
'daily.loading':     'Loading today\'s fragments...',
'daily.fallback':    'Running in offline mode.',
```

---

## 10. Migration & Compatibility

### 10.1 Backward Compatibility

- **Existing localStorage history**: Fully preserved. The `history.js` module is unchanged.
- **Token format**: Daily tokens from the server use `{ id, label, emoji, labelEn }` which is a subset of TOKEN_REGISTRY token format (missing `difficulty` and `tags`). The `formatCombo()`, `calculateDifficulty()` functions handle missing fields gracefully (difficulty defaults to 0, tags are optional).
- **Offline play**: If API is unreachable, the fallback hash generates daily tokens locally. Users can still play but community submission will fail silently (local history is always saved regardless).

### 10.2 Token Pool Divergence

The server has 10 tokens per pouch; the client TOKEN_REGISTRY has 20 per pouch with different IDs. For daily mode:

- Server tokens (`red-door`, `blue-singing`, etc.) are used as daily tokens.
- Client TOKEN_REGISTRY tokens (`red-001`, `blue-001`, etc.) remain for the fallback/random pool.
- `lookupTokenById` in tokens.js searches both pools.
- `renderReview`, `renderComplete`, `formatCombo` work with any token that has `{label, labelEn}`.

### 10.3 Anonymous Identity for Likes

The backend's `/records/:id/like` endpoint accepts either:
- Authenticated user (`userId` from JWT)
- Anonymous fingerprint (`x-anon-fingerprint` header or `anon_fingerprint` cookie)

Client-side implementation in `api.js`:
```js
function getAnonFingerprint() {
  const KEY = 'nova-pouch-anon-fp';
  let fp = localStorage.getItem(KEY);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(KEY, fp);
  }
  return fp;
}

// Used in apiPost for like endpoint:
headers['x-anon-fingerprint'] = getAnonFingerprint();
```

---

## 11. Implementation Order

### Phase 1: API Foundation + Daily Tokens
**Files: `js/api.js` (new), `js/daily.js` (new), `js/state.js`, `js/pouch.js`, `js/app.js`, `js/tokens.js`**

1. Create `js/api.js` -- HTTP client
2. Create `js/daily.js` -- with embedded server token pools and hashWithPrime
3. Extend `js/state.js` -- new PHASES, ACTIONS, initial state fields
4. Modify `js/pouch.js` line 165 -- switch from `getRandomToken` to `getDailyToken`
5. Modify `js/app.js` START_GAME handler -- async fetch before dispatch
6. Add `lookupTokenById` to `js/tokens.js`
7. Test: verify daily tokens match server output for known dates

### Phase 2: Community Feed
**Files: `js/feed.js` (new), `js/renderer.js`, `js/app.js`, `index.html`, `js/i18n.js`**

1. Create `js/feed.js` -- feed state, pagination, like toggle
2. Add feed layer HTML to `index.html`
3. Extend `js/renderer.js` -- cacheDOM for feed, updateVisibility, renderFeed
4. Extend `js/app.js` -- feed button bindings, like delegation, record submission
5. Add i18n strings for feed UI
6. Add CSS for feed cards (new file `css/feed.css` or add to `css/screens.css`)

### Phase 3: Image Generation
**Files: `js/share.js` (new)**

1. Create `js/share.js` -- canvas rendering, font loading, wrapText
2. Test across browsers (Chrome, Safari, Firefox) for emoji rendering
3. Verify font availability and fallback behavior

### Phase 4: Social Sharing
**Files: `js/share.js` (extend), `js/app.js`, `index.html`**

1. Add Twitter intent, download, native share to `js/share.js`
2. Replace share button with share panel in `index.html`
3. Replace `bindShareButton()` in `js/app.js` with multi-action handlers
4. Add URL param parsing in `bootstrap()` for `?date=` deep links
5. Add i18n strings for share panel

### Dependency Graph (implementation order)

```
Phase 1: api.js + daily.js + state.js + pouch.js + app.js + tokens.js
    |
    v
Phase 2: feed.js + renderer.js + app.js + index.html + i18n.js
    |
    v
Phase 3: share.js (canvas)
    |
    v
Phase 4: share.js (social) + app.js + index.html
```

Phase 3 and 4 can be developed in parallel with Phase 2 since they have no data dependency on the feed module. However, Phase 2 depends on Phase 1 (daily tokens provide the date context for the feed).
