# R02 Performance & Offline Plan

> Specialist perspective: Performance, Resilience, Offline-first.
> Scope: Daily Token, Community Feed, Image Generation, Social Sharing.

---

## 1. Daily Token --- Offline Resilience

### 1.1 Core Requirement

The game MUST work without internet. The daily token is a "community mode" enhancement,
not a gate. If the API is unreachable, the client computes identical tokens locally.

### 1.2 Server Algorithm (Exact Copy)

The server (in `jiun-api/src/services/novaPouch.service.ts`) uses a deterministic
hash with prime multiplication to select one token per pouch per day.

#### Server Token Arrays (verbatim)

These arrays MUST be duplicated in the client exactly as they appear on the server.
They are a **separate, smaller set** from the existing `TOKEN_REGISTRY` (which has
20 tokens per pouch for the random single-player mode). The daily mode uses 10 per pouch.

```javascript
// js/daily-tokens.js --- Daily Token Data (must match server exactly)

export const DAILY_RED_TOKENS = [
  { id: 'red-door',    label: '문',   emoji: '🚪', labelEn: 'Door' },
  { id: 'red-key',     label: '열쇠', emoji: '🗝️',  labelEn: 'Key' },
  { id: 'red-book',    label: '책',   emoji: '📘', labelEn: 'Book' },
  { id: 'red-clock',   label: '시계', emoji: '⏰', labelEn: 'Clock' },
  { id: 'red-bridge',  label: '다리', emoji: '🌉', labelEn: 'Bridge' },
  { id: 'red-window',  label: '창문', emoji: '🪟', labelEn: 'Window' },
  { id: 'red-letter',  label: '편지', emoji: '✉️',  labelEn: 'Letter' },
  { id: 'red-mirror',  label: '거울', emoji: '🪞', labelEn: 'Mirror' },
  { id: 'red-island',  label: '섬',   emoji: '🏝️', labelEn: 'Island' },
  { id: 'red-train',   label: '기차', emoji: '🚆', labelEn: 'Train' },
];

export const DAILY_BLUE_TOKENS = [
  { id: 'blue-singing',    label: '노래하는',       emoji: '🎵', labelEn: 'Singing' },
  { id: 'blue-floating',   label: '떠다니는',       emoji: '🫧', labelEn: 'Floating' },
  { id: 'blue-burning',    label: '타오르는',       emoji: '🔥', labelEn: 'Burning' },
  { id: 'blue-whispering', label: '속삭이는',       emoji: '🗣️', labelEn: 'Whispering' },
  { id: 'blue-forgotten',  label: '잊혀진',         emoji: '🫥', labelEn: 'Forgotten' },
  { id: 'blue-endless',    label: '끝없는',         emoji: '♾️',  labelEn: 'Endless' },
  { id: 'blue-fragile',    label: '부서지기 쉬운',  emoji: '🧊', labelEn: 'Fragile' },
  { id: 'blue-luminous',   label: '빛나는',         emoji: '✨', labelEn: 'Luminous' },
  { id: 'blue-silent',     label: '고요한',         emoji: '🤫', labelEn: 'Silent' },
  { id: 'blue-invisible',  label: '보이지 않는',    emoji: '🫥', labelEn: 'Invisible' },
];

export const DAILY_GREEN_TOKENS = [
  { id: 'green-two-people',      label: '2명이 동시에',      emoji: '👥',  labelEn: 'Two people at once' },
  { id: 'green-under-rain',      label: '비가 오는 동안만',   emoji: '🌧️', labelEn: 'Only while raining' },
  { id: 'green-before-sunrise',  label: '해뜨기 전에만',     emoji: '🌅', labelEn: 'Before sunrise only' },
  { id: 'green-no-words',        label: '말 없이',           emoji: '🤐', labelEn: 'Without words' },
  { id: 'green-with-closed-eyes',label: '눈을 감은 채',      emoji: '🙈', labelEn: 'With eyes closed' },
  { id: 'green-once-lifetime',   label: '인생에서 한 번만',   emoji: '1️⃣',  labelEn: 'Only once in a lifetime' },
  { id: 'green-in-midnight',     label: '자정에만',           emoji: '🕛', labelEn: 'At midnight only' },
  { id: 'green-without-touch',   label: '손대지 않고',        emoji: '🫳', labelEn: 'Without touching' },
  { id: 'green-in-public',       label: '사람들 앞에서만',    emoji: '🎭', labelEn: 'Only in public' },
  { id: 'green-in-three-minutes',label: '3분 안에',           emoji: '⏳', labelEn: 'Within three minutes' },
];
```

#### Hash Algorithm (verbatim port from server)

```javascript
// js/daily-hash.js --- Deterministic daily token selection

import {
  DAILY_RED_TOKENS,
  DAILY_BLUE_TOKENS,
  DAILY_GREEN_TOKENS,
} from './daily-tokens.js';

/**
 * Port of server's hashWithPrime(). Uses char-by-char accumulation
 * with a prime multiplier, modulo 2^31 - 1 (2_147_483_647).
 *
 * CRITICAL: This function must be kept in perfect sync with
 * jiun-api/src/services/novaPouch.service.ts::hashWithPrime().
 *
 * @param {string} input
 * @param {number} prime
 * @returns {number}
 */
function hashWithPrime(input, prime) {
  let hash = 0;
  for (const char of input) {
    hash = (hash + char.charCodeAt(0) * prime) % 2_147_483_647;
  }
  return hash;
}

/**
 * Compute today's daily tokens deterministically.
 * Matches server's getDailyTokens() exactly.
 *
 * @param {string} [dateStr] - 'YYYY-MM-DD' format. Defaults to today (UTC).
 * @returns {{ red: object, blue: object, green: object }}
 */
export function computeDailyTokens(dateStr) {
  const normalized = dateStr || todayDateString();
  return {
    red:   DAILY_RED_TOKENS[hashWithPrime(`${normalized}:red`, 31)   % DAILY_RED_TOKENS.length],
    blue:  DAILY_BLUE_TOKENS[hashWithPrime(`${normalized}:blue`, 37)  % DAILY_BLUE_TOKENS.length],
    green: DAILY_GREEN_TOKENS[hashWithPrime(`${normalized}:green`, 41) % DAILY_GREEN_TOKENS.length],
  };
}

/**
 * Get today's date as 'YYYY-MM-DD' in UTC.
 * @returns {string}
 */
export function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}
```

**Key correctness details:**
- The server iterates using `for (const char of input)`, which correctly handles
  multi-byte/surrogate pairs. The JS client `for...of` loop has identical semantics.
- `charCodeAt(0)` is called on single characters, so it returns the same numeric
  value as TypeScript's `char.charCodeAt(0)`.
- The modulo is `2_147_483_647` (2^31 - 1, a Mersenne prime). JavaScript handles
  this safely within `Number.MAX_SAFE_INTEGER`.
- The primes are 31, 37, 41 for red, blue, green respectively.
- Array lengths are all 10 on the server; indices are `hash % 10`.

#### Verification

Add a one-time dev assertion during development:

```javascript
// In dev mode only
if (import.meta.env?.DEV) {
  fetch('/api/nova-pouch/daily-tokens')
    .then(r => r.json())
    .then(serverTokens => {
      const local = computeDailyTokens();
      console.assert(
        serverTokens.red.id === local.red.id &&
        serverTokens.blue.id === local.blue.id &&
        serverTokens.green.id === local.green.id,
        'Daily token mismatch! Client hash diverged from server.',
        { server: serverTokens, local }
      );
    })
    .catch(() => { /* offline, skip check */ });
}
```

### 1.3 Caching Strategy

```
Layer 1: sessionStorage (per-tab, cleared on close)
Layer 2: Client-side deterministic computation (always available)
Layer 3: API fetch (authoritative, refreshes cache)
```

#### sessionStorage Cache

```javascript
const DAILY_CACHE_KEY = 'nova-pouch-daily';

function getCachedDaily() {
  try {
    const raw = sessionStorage.getItem(DAILY_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // Validate date match
    if (cached.date !== todayDateString()) return null;
    return cached.tokens;
  } catch {
    return null;
  }
}

function setCachedDaily(tokens, date) {
  try {
    sessionStorage.setItem(DAILY_CACHE_KEY, JSON.stringify({
      date,
      tokens,
      fetchedAt: Date.now(),
    }));
  } catch {
    // sessionStorage full or unavailable -- non-critical
  }
}
```

**Why sessionStorage, not localStorage:**
- Daily tokens change every day. sessionStorage auto-clears on tab close, preventing
  stale data from persisting overnight.
- localStorage is already used for history (up to ~50KB for 100 sessions). No need
  to compete for quota.
- If the user opens a new tab the next day, the cache is empty, forcing a fresh
  computation or fetch.

### 1.4 Loading Strategy

The daily token fetch MUST NOT block game start. The existing single-player random
mode (pouch.js using TOKEN_REGISTRY) works fully offline. The daily mode is additive.

```
Page Load Timeline
==================

DOMContentLoaded
  |
  +--> bootstrap() [existing: initI18n, initRenderer, initPouch, bindButtons]
  |
  +--> prefetchDailyTokens() [new, non-blocking]
         |
         +--> Return cached (sessionStorage) immediately if valid
         |    OR
         +--> computeDailyTokens() client-side as instant fallback
         |
         +--> fire-and-forget: fetch('/api/nova-pouch/daily-tokens')
                |
                +--> on success: update cache, verify against local hash
                +--> on failure: silently use local computation
```

Implementation:

```javascript
// js/daily.js

import { computeDailyTokens, todayDateString } from './daily-hash.js';

const API_TIMEOUT_MS = 2000;
let _dailyTokens = null;
let _dailyDate = null;
let _source = null;  // 'cache' | 'local' | 'api'

/**
 * Get daily tokens. Returns immediately (sync) from cache or local hash.
 * Background fetch updates the cache for next access.
 */
export function getDailyTokens() {
  if (_dailyTokens && _dailyDate === todayDateString()) {
    return { tokens: _dailyTokens, date: _dailyDate, source: _source };
  }

  const today = todayDateString();

  // Layer 1: sessionStorage
  const cached = getCachedDaily();
  if (cached) {
    _dailyTokens = cached;
    _dailyDate = today;
    _source = 'cache';
    backgroundRefresh(today);
    return { tokens: _dailyTokens, date: _dailyDate, source: _source };
  }

  // Layer 2: local deterministic computation
  _dailyTokens = computeDailyTokens(today);
  _dailyDate = today;
  _source = 'local';
  setCachedDaily(_dailyTokens, today);
  backgroundRefresh(today);
  return { tokens: _dailyTokens, date: _dailyDate, source: _source };
}

/**
 * Non-blocking API fetch with timeout. Updates in-memory state and cache.
 */
function backgroundRefresh(dateStr) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  fetch(`/api/nova-pouch/daily-tokens?date=${dateStr}`, {
    signal: controller.signal,
  })
    .then(response => {
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      _dailyTokens = data.tokens || data;
      _dailyDate = dateStr;
      _source = 'api';
      setCachedDaily(_dailyTokens, dateStr);
    })
    .catch(() => {
      clearTimeout(timeoutId);
      // Silently use local computation. Already cached.
    });
}

export function prefetchDailyTokens() {
  getDailyTokens();
}
```

### 1.5 Slow API / Timeout Handling

| Scenario | Behavior |
|----------|----------|
| API responds < 2s | Use API response, update cache |
| API responds 2-10s | Client already using local hash; API response updates cache for next read |
| API unreachable | Client uses local hash; no error shown to user |
| API returns mismatched tokens | Log warning (dev); use API response (server is authoritative) |
| Wrong date cached (midnight rollover) | `todayDateString()` check invalidates stale cache |

**No loading spinner for daily tokens.** The local computation is instant (~0.01ms).
The user never perceives a wait.

### 1.6 Edge Cases

**Midnight rollover:** If a user has the tab open across midnight UTC, the daily
tokens change. This is handled by always comparing `_dailyDate` against
`todayDateString()` at access time. If the date differs, the cache is stale and
recomputation occurs.

**Timezone mismatch:** The server uses `new Date().toISOString().slice(0, 10)` which
is UTC. The client must also use UTC. The `todayDateString()` function above does this.

**Token array versioning:** If the server's token arrays are ever updated, the client
arrays must be updated to match. This is a deployment concern, not a runtime concern.
Add a `DAILY_TOKEN_VERSION` constant and log a mismatch in dev mode. For production,
the API response is always authoritative -- if it disagrees with local, use the API.

### 1.7 Bundle Size Impact

The daily token arrays are 10 items per pouch, 30 total. Each token is ~80 bytes
of JSON. Total addition: ~2.4KB unminified, ~1.2KB minified, ~0.5KB gzipped.
The hash function is ~150 bytes minified. Negligible impact.

---

## 2. Community Feed --- Performance

### 2.1 Lazy Loading Architecture

The community feed is a NEW feature not present in the current codebase. It should
be loaded on demand -- never fetched until the user navigates to it.

```
Current phases:  IDLE -> DRAWING -> REVIEW -> WRITING -> COMPLETE -> HISTORY
New addition:    COMMUNITY (accessible from IDLE or COMPLETE)
```

#### Code-Split the Feed Module

```javascript
// js/community.js --- Lazy-loaded community feed module
// This file is imported dynamically, not in the static import graph.

let _feedModule = null;

export async function openCommunityFeed() {
  if (!_feedModule) {
    // Dynamic import -- only fetches when first needed
    _feedModule = await import('./feed.js');
  }
  _feedModule.show();
}
```

In `app.js`, bind the community button:

```javascript
bindButtons(['[data-action="community"]', '#btn-community'], async () => {
  const { openCommunityFeed } = await import('./community.js');
  openCommunityFeed();
});
```

**Bundle isolation:** `feed.js` and its dependencies (feed rendering, pagination,
like handling) are only fetched on first community navigation. On a typical session
where the user only plays single-player, the feed code is never downloaded.

### 2.2 Pagination vs Infinite Scroll

**Decision: Cursor-based pagination with a "Load More" button.**

Rationale:
- **Infinite scroll** causes memory bloat on mobile. 100+ feed cards with emoji
  rendering, avatars, and story text can easily consume 50MB+ of DOM nodes.
- **Traditional pagination** (page 1, 2, 3...) breaks spatial memory on mobile
  and requires full re-renders.
- **"Load More"** is the best compromise: user controls when to load more, DOM grows
  incrementally, back-navigation preserves scroll position.

```javascript
const FEED_PAGE_SIZE = 20;

async function loadFeedPage(date, cursor) {
  const params = new URLSearchParams({
    date,
    limit: String(FEED_PAGE_SIZE),
    ...(cursor ? { after: cursor } : {}),
  });

  const response = await fetch(`/api/nova-pouch/records?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

#### DOM Recycling for Long Lists

If the feed grows beyond ~50 items, consider a lightweight virtual scrolling
approach. But for MVP with "Load More" capped at 5 pages (100 items max),
DOM recycling is unnecessary.

### 2.3 Image/Avatar Lazy Loading

```html
<!-- Feed card template -->
<img
  class="feed-card__avatar"
  loading="lazy"
  decoding="async"
  src="data:image/svg+xml,..."  <!-- 1x1 placeholder SVG, inline -->
  data-src="{avatarUrl}"
  width="40"
  height="40"
  alt=""
>
```

Use native `loading="lazy"` (supported in all modern browsers). For the
placeholder, use an inline SVG data URI (no extra HTTP request):

```javascript
const AVATAR_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
  '<rect fill="%231A1B26" width="40" height="40" rx="20"/>' +
  '<text x="20" y="26" text-anchor="middle" fill="%238B8B8B" font-size="16">?</text>' +
  '</svg>'
);
```

For actual avatar loading, use `IntersectionObserver` as a fallback for browsers
where `loading="lazy"` doesn't apply to dynamically created images:

```javascript
const avatarObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      const img = entry.target;
      const realSrc = img.dataset.src;
      if (realSrc) {
        img.src = realSrc;
        img.removeAttribute('data-src');
      }
      avatarObserver.unobserve(img);
    }
  }
}, { rootMargin: '200px' });  // Start loading 200px before visible
```

### 2.4 Like Button Debounce

Likes are a toggle (like/unlike). Users may tap rapidly. Without debounce, this
creates a storm of API requests that may race against each other.

```javascript
// js/feed-likes.js

const LIKE_DEBOUNCE_MS = 500;
const _pendingLikes = new Map();  // recordId -> timeoutId

export function handleLikeClick(recordId, buttonEl) {
  // Optimistic UI update
  const isCurrentlyLiked = buttonEl.classList.contains('is-liked');
  const newLiked = !isCurrentlyLiked;
  buttonEl.classList.toggle('is-liked', newLiked);
  updateLikeCount(buttonEl, newLiked ? 1 : -1);

  // Cancel previous pending request for this record
  if (_pendingLikes.has(recordId)) {
    clearTimeout(_pendingLikes.get(recordId));
  }

  // Debounce the API call
  const timeoutId = setTimeout(async () => {
    _pendingLikes.delete(recordId);
    try {
      const result = await toggleLikeAPI(recordId);
      // Reconcile with server truth
      buttonEl.classList.toggle('is-liked', result.liked);
      setLikeCount(buttonEl, result.likeCount);
    } catch {
      // Revert optimistic update
      buttonEl.classList.toggle('is-liked', isCurrentlyLiked);
      updateLikeCount(buttonEl, isCurrentlyLiked ? 1 : -1);
    }
  }, LIKE_DEBOUNCE_MS);

  _pendingLikes.set(recordId, timeoutId);
}

function updateLikeCount(buttonEl, delta) {
  const countEl = buttonEl.querySelector('.like-count');
  if (countEl) {
    const current = parseInt(countEl.textContent, 10) || 0;
    countEl.textContent = String(Math.max(0, current + delta));
  }
}

function setLikeCount(buttonEl, count) {
  const countEl = buttonEl.querySelector('.like-count');
  if (countEl) {
    countEl.textContent = String(count);
  }
}
```

**Key points:**
- Optimistic UI: Button state changes immediately, no perceived latency.
- If user taps like/unlike/like rapidly, only the final state is sent to server.
- On API failure, revert to previous state.
- 500ms debounce is aggressive enough to batch rapid taps but short enough to
  feel responsive.

### 2.5 Feed Cache with TTL

```javascript
const FEED_CACHE_TTL_MS = 2 * 60 * 1000;  // 2 minutes
const _feedCache = new Map();  // key: "date:page:sort" -> { data, fetchedAt }

function getCachedFeed(key) {
  const entry = _feedCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > FEED_CACHE_TTL_MS) {
    _feedCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedFeed(key, data) {
  // Cap cache size to prevent memory bloat
  if (_feedCache.size > 20) {
    // Evict oldest entry
    const oldestKey = _feedCache.keys().next().value;
    _feedCache.delete(oldestKey);
  }
  _feedCache.set(key, { data, fetchedAt: Date.now() });
}
```

**TTL decision: 2 minutes.** Rationale:
- Too short (< 30s): Defeats caching purpose; every tab switch re-fetches.
- Too long (> 10m): User misses new posts, likes feel stale.
- 2 minutes: Good balance for a daily-cadence community. Stories are posted once/day
  per user. Like counts change slowly.
- On explicit "pull to refresh" or re-navigation, bypass cache and force-fetch.

**Where to cache:**
- In-memory `Map` (not sessionStorage): Feed data includes user objects, avatars,
  stories. Serializing/deserializing to sessionStorage for a 2-minute TTL is wasteful.
- In-memory cache is automatically cleared on page reload.

### 2.6 Feed Error States

| Scenario | UI |
|----------|-----|
| Offline | Show cached data if available; else show "You're offline. Daily tokens still work -- try the community feed when you're back online." |
| API error (5xx) | "Unable to load feed. Pull down to retry." with retry button |
| Empty feed | "No stories yet today. Be the first to share!" |
| Slow (> 3s) | Show skeleton cards (3 placeholder cards with pulse animation) |

---

## 3. Image Generation --- Performance

### 3.1 Problem Statement

The share image (a "Nova Card") composites token emojis, the combo text, and the
user's story onto a canvas. On low-end mobile (2GB RAM Android), canvas operations
can block the main thread for 200-500ms, causing visible jank during the share flow.

### 3.2 OffscreenCanvas Strategy

```javascript
// js/card-generator.js

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

/**
 * Generate the share card image as a Blob.
 * Uses OffscreenCanvas in a worker if available; falls back to main-thread canvas.
 */
export async function generateShareCard(state) {
  const cardData = prepareCardData(state);

  if (typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined') {
    return generateInWorker(cardData);
  }

  return generateOnMainThread(cardData);
}

function prepareCardData(state) {
  // Extract only serializable data needed for rendering
  return {
    red:   { label: state.drawnTokens.red?.label,   emoji: state.drawnTokens.red?.emoji,   labelEn: state.drawnTokens.red?.labelEn },
    blue:  { label: state.drawnTokens.blue?.label,   emoji: state.drawnTokens.blue?.emoji,   labelEn: state.drawnTokens.blue?.labelEn },
    green: { label: state.drawnTokens.green?.label,  emoji: state.drawnTokens.green?.emoji,  labelEn: state.drawnTokens.green?.labelEn },
    story: (state.userStory || '').slice(0, 500),  // Truncate for card
    rating: state.rating || 0,
    locale: 'ko',
  };
}
```

#### Worker Approach

```javascript
// js/card-worker.js (Web Worker)

self.addEventListener('message', async (event) => {
  const { cardData, width, height } = event.data;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  renderCard(ctx, cardData, width, height);

  const blob = await canvas.convertToBlob({ type: 'image/png', quality: 0.92 });
  self.postMessage({ blob }, []);
});

function renderCard(ctx, data, w, h) {
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0F0C29');
  grad.addColorStop(1, '#1A1B26');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Token emojis (rendered as text -- native emoji)
  ctx.font = '64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.red.emoji || '', w * 0.25, 200);
  ctx.fillText(data.blue.emoji || '', w * 0.5, 200);
  ctx.fillText(data.green.emoji || '', w * 0.75, 200);

  // Combo text
  ctx.font = '32px serif';
  ctx.fillStyle = '#E8E6E3';
  ctx.fillText(formatComboText(data), w / 2, 300);

  // Story excerpt
  ctx.font = '24px serif';
  wrapText(ctx, data.story, 60, 400, w - 120, 32);

  // Branding
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#8B8B8B';
  ctx.fillText('NOVA POUCH', w / 2, h - 40);
}
```

#### Fallback (Main Thread)

```javascript
function generateOnMainThread(cardData) {
  return new Promise((resolve) => {
    // Use requestAnimationFrame to avoid blocking during transitions
    requestAnimationFrame(() => {
      const canvas = document.createElement('canvas');
      canvas.width = CARD_WIDTH;
      canvas.height = CARD_HEIGHT;
      const ctx = canvas.getContext('2d');

      renderCardMainThread(ctx, cardData, CARD_WIDTH, CARD_HEIGHT);

      canvas.toBlob((blob) => {
        // Explicit cleanup
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      }, 'image/png', 0.92);
    });
  });
}
```

### 3.3 Emoji Rendering: Native vs Twemoji

**Decision: Use native emoji rendering. Do NOT add twemoji.**

Rationale:
| Factor | Native Emoji | Twemoji CDN |
|--------|-------------|-------------|
| Bundle size | 0 KB | ~800KB (SVG set) or per-emoji HTTP requests |
| Offline | Works always | Requires caching or pre-download |
| Rendering speed | Instant (OS-level) | Requires image decode per emoji |
| Cross-platform consistency | Varies by OS | Identical everywhere |
| Canvas support | `fillText()` works | Requires `drawImage()` with loaded SVGs |

Cross-platform variation is acceptable for this game. The emoji are decorative, not
functional. If a specific emoji renders as a tofu box on an old device, the text
label is always present as backup.

**Caveat for canvas rendering:** Some older Android WebViews render emoji as monochrome
in canvas `fillText()`. Test on target devices. If this is a problem, add a fallback
that skips emoji in the canvas and renders only text labels.

### 3.4 Image Size Optimization

```
Target: Share card should be < 200KB for fast upload/download.

Canvas resolution: 1080 x 1350 (3:4 aspect, Instagram-friendly)
  - This is 2x for 540x675 display (retina)
  - On devices with lower memory, scale down to 720 x 900

Format: PNG for sharp text/emoji; JPEG for photo-heavy cards (not our case)

Quality: 0.92 (PNG quality hint, mostly ignored; PNG is lossless)
         For JPEG fallback: 0.8 gives good compression with acceptable quality

File size estimate:
  - Dark gradient background + text + emoji = ~80-150KB PNG
  - Well within target
```

**Adaptive resolution:**

```javascript
function getCardDimensions() {
  // On low-memory devices, reduce resolution
  const memoryGB = navigator.deviceMemory || 4;  // Default 4 if API unavailable
  if (memoryGB <= 2) {
    return { width: 720, height: 900 };
  }
  return { width: 1080, height: 1350 };
}
```

### 3.5 Memory Cleanup

Canvas elements retain their pixel buffer in GPU memory. On mobile, failing to
clean up can cause memory warnings or even tab crashes.

```javascript
function cleanupCanvas(canvas) {
  if (!canvas) return;

  // Setting dimensions to 0 releases the backing pixel buffer
  canvas.width = 0;
  canvas.height = 0;

  // Remove from DOM if attached
  if (canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }
}
```

**Worker cleanup:** OffscreenCanvas in a worker is automatically garbage-collected
when the worker terminates. For long-lived workers, explicitly close:

```javascript
// In worker, after sending blob back
self.close();  // Terminates worker, frees all canvas memory
```

**Timing:** Generate the card only when the user taps "Share" or "Download", not
preemptively. Canvas creation + rendering + blob conversion takes ~100-300ms, which
is acceptable as a one-time cost on user action.

---

## 4. Social Sharing --- Network Considerations

### 4.1 Sharing Methods & Offline Capabilities

| Method | Works Offline? | Notes |
|--------|---------------|-------|
| Twitter/X intent URL | Partially | Opens `https://twitter.com/intent/tweet?text=...` in browser. URL construction is offline; the browser handles network. |
| Blob download (save image) | Yes | Canvas rendering + `URL.createObjectURL()` + `<a download>` is fully client-side. |
| `navigator.share()` | Depends | The API itself works offline (it delegates to OS share sheet). But shared content may reference URLs that need network. |
| `navigator.clipboard.writeText()` | Yes | Fully client-side. |
| KakaoTalk share | No | Requires Kakao JS SDK + network for link preview. |

### 4.2 Twitter Intent (Offline-Safe)

```javascript
function shareToTwitter(text) {
  const encoded = encodeURIComponent(text);
  const url = `https://twitter.com/intent/tweet?text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  // No network required to *construct* this URL.
  // The browser will navigate and handle connectivity itself.
}
```

**Character limit awareness:** Twitter has a 280-character limit. Truncate the
share text to ~250 chars (leaving room for the URL if we add one later):

```javascript
function buildTwitterText(state) {
  const combo = formatCombo(state.drawnTokens);
  const story = (state.userStory || '').trim();
  const prefix = `Nova Pouch: "${combo}"\n\n`;
  const maxStory = 250 - prefix.length;
  const truncated = story.length > maxStory
    ? story.slice(0, maxStory - 3) + '...'
    : story;
  return prefix + truncated;
}
```

### 4.3 Blob Download (Fully Offline)

```javascript
async function downloadShareCard(state) {
  const blob = await generateShareCard(state);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nova-pouch-${todayDateString()}.png`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Cleanup after a short delay (some browsers need the element to persist briefly)
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 1000);
}
```

**No network needed.** This works in airplane mode.

### 4.4 navigator.share() Considerations

```javascript
async function nativeShare(state) {
  if (!navigator.share) {
    // Fallback to clipboard copy
    return clipboardShare(state);
  }

  const shareText = buildShareText(state);

  // Check if we can share files (for the image card)
  const canShareFiles = navigator.canShare && navigator.canShare({
    files: [new File([], 'test.png', { type: 'image/png' })],
  });

  const shareData = {
    title: 'Nova Pouch',
    text: shareText,
  };

  if (canShareFiles) {
    try {
      const blob = await generateShareCard(state);
      if (blob) {
        shareData.files = [
          new File([blob], `nova-pouch-${todayDateString()}.png`, { type: 'image/png' }),
        ];
      }
    } catch {
      // Image generation failed; share text only
    }
  }

  try {
    await navigator.share(shareData);
  } catch (err) {
    // User cancelled or error
    if (err.name !== 'AbortError') {
      console.warn('Share failed:', err);
    }
  }
}
```

**HTTPS requirement:** `navigator.share()` requires a secure context (HTTPS or
localhost). The production site should always be HTTPS. For local development,
`localhost` is treated as secure.

### 4.5 Shareable URL Structure

If we add a shareable URL that links to a specific record (e.g.,
`https://nova-pouch.app/record/{id}`), it must handle the case where the API
is down when someone opens that link.

```
URL: /record/{recordId}

Resolution:
1. Client loads the SPA shell (cached by service worker if available)
2. Client attempts to fetch /api/nova-pouch/records/{recordId}
3. If success: render the record
4. If offline/error:
   a. Show: "This record couldn't be loaded right now."
   b. Offer: "Play Nova Pouch" button (game works offline)
   c. Do NOT show a broken/empty card
```

**No service worker in current codebase.** The shareable URL strategy should work
without a service worker. The SPA is a single `index.html` served by a static host.
If the host is reachable, the page loads. If not, the browser shows its own offline
error. This is acceptable for MVP.

**Future (post-MVP):** Add a service worker to cache the app shell, enabling the
shareable URL to at least load the SPA and show a graceful error state.

---

## 5. Cross-Cutting: Mobile Performance

### 5.1 Current State Analysis

The existing codebase is well-optimized for mobile:
- CSS animations use `transform`/`opacity` only (GPU-composited)
- `will-change` is applied just before animation and removed after
- `prefers-reduced-motion` is respected (animation duration set to 0)
- Event handlers use `pointerdown`/`pointerup` (unified touch/mouse)
- `navigator.vibrate()` for haptic feedback
- No heavy dependencies (vanilla JS, ~15KB total)

### 5.2 New Feature Budget

| Feature | Estimated Size (minified, gzipped) | Main Thread Cost |
|---------|-----------------------------------|-----------------|
| Daily token hash + arrays | ~0.5KB | <1ms computation |
| Community feed module | ~3KB | Lazy-loaded; 0ms at startup |
| Card generator | ~2KB | 100-300ms on share (one-time) |
| Social share logic | ~1KB | <1ms |
| **Total new code** | **~6.5KB** | **<1ms at startup** |

**Target:** Total JS payload should stay under 30KB gzipped. Currently ~15KB.
Adding ~6.5KB keeps us well within budget.

### 5.3 Passive Event Listeners

The existing `pouch.js` uses `addEventListener('pointerdown', ...)` which Chrome
will warn about on mobile if on a scrollable area. Ensure passive where possible:

```javascript
// For events where we do NOT call preventDefault():
element.addEventListener('pointerdown', handler, { passive: true });

// For events where we DO call preventDefault() (e.g., keydown space):
element.addEventListener('keydown', handler, { passive: false });
```

The current code calls `setPointerCapture` inside `pointerdown`, which requires
a non-passive listener. This is fine -- just ensure it's explicitly marked.

### 5.4 Font Loading Performance

Current `index.html` loads two web fonts:
- Pretendard (variable, dynamic subset) from jsDelivr CDN
- Nanum Myeongjo from Google Fonts

Both use `<link rel="preconnect">` which is good. Consider adding `font-display: swap`
to avoid invisible text during load:

```css
/* In main.css, if not already present */
@font-face {
  font-display: swap;  /* Show fallback immediately, swap when loaded */
}
```

**For the share card canvas:** Canvas `fillText()` uses whatever font is loaded.
If Nanum Myeongjo hasn't loaded yet, the canvas will use the fallback font.
To ensure consistent card rendering, use `document.fonts.ready`:

```javascript
async function generateShareCard(state) {
  // Wait for fonts to be available (for canvas text rendering)
  await document.fonts.ready;
  // ... proceed with canvas rendering
}
```

### 5.5 Memory Pressure on Low-End Devices

On devices with <= 2GB RAM (common in developing markets), aggressive memory
management is important:

1. **Feed DOM:** Cap at 100 feed cards. "Load More" replaces oldest cards instead
   of appending indefinitely.
2. **Canvas:** Always clean up immediately after blob extraction (see 3.5).
3. **Event listeners:** The existing code marks elements with `dataset.boundPouch`
   etc. to prevent double-binding. This is good practice.
4. **History rendering:** Already capped at 10 items in preview, 100 in storage.

---

## 6. Error Handling Summary

### 6.1 Error Hierarchy

```
Level 1: Silent recovery (user never knows)
  - sessionStorage read/write failure -> skip cache, use in-memory
  - Daily token API timeout -> use local hash
  - Avatar image load failure -> show placeholder

Level 2: Graceful degradation (user sees a hint)
  - Feed load failure -> "Unable to load. Retry?" with retry button
  - Like API failure -> revert optimistic UI, no error toast
  - Share card generation failure -> fall back to text-only share

Level 3: User notification (explicit message)
  - Offline detection -> subtle indicator: "Offline mode" pill
  - Story submission failure -> "Couldn't save to community. Your story is saved locally."
```

### 6.2 Offline Detection

```javascript
function isOnline() {
  return navigator.onLine !== false;  // true if unknown or online
}

// Listen for connectivity changes
window.addEventListener('online', () => {
  hidePill('offline-indicator');
  // Opportunistic refresh of daily tokens
  prefetchDailyTokens();
});

window.addEventListener('offline', () => {
  showPill('offline-indicator');
});
```

**Do NOT block anything on offline status.** The game works fully offline. The
community features gracefully degrade. The offline indicator is informational only.

---

## 7. Implementation Priority

| Priority | Task | Blocking? |
|----------|------|-----------|
| P0 | `daily-tokens.js` + `daily-hash.js` (client-side hash) | Yes -- needed before daily mode UI |
| P0 | `daily.js` (cache + prefetch + fallback chain) | Yes -- daily mode depends on this |
| P1 | Feed lazy loading + pagination | No -- can ship daily mode first |
| P1 | Like debounce | No -- but should ship with feed |
| P2 | Card generator (`card-generator.js` + `card-worker.js`) | No -- share works with text first |
| P2 | `navigator.share()` with image | No -- text share is MVP |
| P3 | Feed caching (TTL map) | No -- nice optimization |
| P3 | OffscreenCanvas worker | No -- main-thread fallback is fine for MVP |

---

## 8. Testing Checklist

### Offline Resilience
- [ ] Daily tokens compute correctly with no network (compare against server output for 10 known dates)
- [ ] `hashWithPrime('2026-03-03:red', 31) % 10` returns same index on client and server
- [ ] sessionStorage cache invalidates at midnight UTC
- [ ] Game start -> draw -> write -> complete works in airplane mode
- [ ] Opening community feed offline shows graceful error, not blank screen

### Performance
- [ ] Page load to interactive < 1.5s on 3G (throttled)
- [ ] Feed lazy load: no feed-related network requests until user opens feed
- [ ] Card generation < 500ms on mid-range mobile (Moto G Power or similar)
- [ ] Memory stays under 100MB after 10 share card generations
- [ ] Like button debounce: 5 rapid taps produce only 1 API call

### Cross-Platform
- [ ] Emoji render correctly in canvas on iOS Safari, Chrome Android, desktop Chrome
- [ ] `navigator.share()` works on iOS Safari, Chrome Android
- [ ] Blob download works on all target browsers
- [ ] Twitter intent opens correctly on mobile (deep link to app if installed)
