# R02 Merged Plan: Nova Pouch Frontend-Backend Integration

> Synthesized from 4 agent perspectives: UX, Technical, Performance/Offline, Architecture
> Date: 2026-03-03

---

## Executive Summary

Integrate Nova Pouch frontend with jiun-api backend to deliver 4 features:
1. **Daily Tokens** — deterministic, same for everyone, with offline fallback
2. **Community Feed** — browse others' stories, like them
3. **Share Card** — Canvas-generated PNG image of results
4. **Social Sharing** — Twitter, native share, clipboard, image download

**Budget**: ~6.5KB gzipped new JS. Zero startup cost (lazy-load feed/share).

---

## Agreements (All 4 Plans Align)

| Topic | Consensus |
|-------|-----------|
| Daily token fallback | Client-side `hashWithPrime()` port — identical algorithm to server |
| Draw animation preserved | Pouches still animate shuffle; result is predetermined daily token |
| Feed is lazy-loaded | Never fetched until user navigates to it |
| Feed pagination | "Load More" button (not infinite scroll) |
| Share image | Canvas API → PNG blob → download or navigator.share() |
| Twitter share | Intent URL (`twitter.com/intent/tweet?text=...`) |
| Clipboard copy | Keep existing, add alongside new share methods |
| Offline-first | Game works fully offline; community features degrade gracefully |
| sessionStorage for daily cache | Not localStorage (auto-clears on tab close) |
| No new dependencies | Vanilla JS, no frameworks, no twemoji |
| i18n maintained | ~30 new ko/en string keys |

---

## Conflicts Resolved

### 1. Feed: Overlay vs New Phase
- **UX**: Overlay panel (slides right, like History)
- **Tech/Arch**: New `FEED` state phase
- **Resolution**: **Overlay** — matches existing History pattern, avoids disrupting the state machine's linear game flow. Feed is accessible from IDLE and COMPLETE via a button. No new PHASES needed; use the existing overlay pattern (`layer-feed` similar to `layer-history`).

### 2. Daily Token Data: Shared vs Separate Arrays
- **Perf**: Separate 10-token arrays per pouch (must match server's `novaPouch.service.ts`)
- **Tech**: Reuse existing TOKEN_REGISTRY (20 per pouch)
- **Resolution**: **Separate daily arrays** — the server has its own 10-token pools. Client must duplicate them exactly. Keep TOKEN_REGISTRY for random/single-player mode.

### 3. Module Structure
- **Tech**: `api.js`, `daily.js`, `feed.js`, `share.js`
- **Perf**: `daily-tokens.js`, `daily-hash.js`, `daily.js`, `card-generator.js`, `card-worker.js`
- **Arch**: `api.js`, `feed.js`, `shareImage.js`, `social.js`
- **Resolution**: Balanced approach:

```
js/
├── api.js              # HTTP client (GET/POST, error handling, timeout)
├── daily.js            # Daily token fetch + cache + fallback hash
├── daily-tokens.js     # Token arrays (must match server exactly)
├── feed.js             # Community feed: fetch, pagination, likes
├── share.js            # Canvas image gen + social sharing + download
└── card-worker.js      # OffscreenCanvas Web Worker (P2, optional)
```

### 4. Feed Pagination Style
- **Perf**: Cursor-based (`after` param)
- **Tech**: Page-based (`page` param)
- **Resolution**: **Page-based** — matches the existing backend API (`GET /records?page=&limit=`). Simpler. The backend already returns `{ records, page, totalPages }`.

### 5. API Base URL
- **Tech** referenced `api.jiun.xyz`
- **Resolution**: `https://api.jiun.dev/nova-pouch` — matches actual K8s ingress config.

---

## Implementation Plan

### Phase 1: Daily Tokens (P0 — Blocking)

**Files**: `js/daily-tokens.js` (new), `js/daily.js` (new), `js/api.js` (new), `js/pouch.js` (modify), `js/app.js` (modify), `js/state.js` (modify)

1. **`js/daily-tokens.js`** — 3 arrays of 10 tokens each, exactly matching server
2. **`js/api.js`** — Thin fetch wrapper: `apiGet(path, params)`, `apiPost(path, body)`
   - Base URL: `https://api.jiun.dev/nova-pouch`
   - 2-second timeout for daily, 15-second for feed/records
   - `credentials: 'include'` for auth cookies
3. **`js/daily.js`** — Token resolution chain:
   - Layer 1: In-memory cache (same tab)
   - Layer 2: sessionStorage (same session, different tabs)
   - Layer 3: Client-side `hashWithPrime()` computation (instant, always available)
   - Layer 4: API fetch (background, updates cache)
   - **No loading spinner** — local hash is instant (<1ms)
4. **`js/state.js`** — Add `SET_DAILY_TOKENS` action. Store `dailyTokens: { red, blue, green }` in state.
5. **`js/pouch.js`** — On `DRAW_TOKEN`, use `getDailyToken(color)` instead of `getRandomToken(color)`.
   - Keep shuffle animation (300ms visual shuffle, then reveal fixed result)
6. **`js/app.js`** — Call `prefetchDailyTokens()` in `bootstrap()` (non-blocking)

**UX Flow** (from UX plan):
- IDLE screen shows "오늘의 조합" daily banner with date
- User starts → draws from red pouch → sees shuffle animation → token is revealed (predetermined)
- Draw experience feels identical to random mode, but everyone gets the same result

**Midnight Rollover**: `todayDateString()` always uses UTC. Cache invalidates when date changes.

### Phase 2: Community Feed (P1)

**Files**: `js/feed.js` (new), `js/renderer.js` (modify), `index.html` (modify), `css/feed.css` (new), i18n keys

1. **`js/feed.js`** — Feed module (lazy-loaded via dynamic `import()`)
   - `loadFeed(date, page)` → `GET /records?date=&page=&limit=20`
   - `toggleLike(recordId)` → `POST /records/:id/like`
   - Optimistic UI for likes with 500ms debounce
   - In-memory cache with 2-minute TTL
2. **`index.html`** — Add `<section id="layer-feed" class="layer">` overlay
3. **`js/renderer.js`** — Render feed cards in overlay:
   - Each card: tokens (emoji chips), username, story excerpt, like button + count
   - "Load More" button at bottom
   - Skeleton loading cards (3 placeholder cards with pulse animation)
4. **`css/feed.css`** — Feed card styles, using existing CSS variables
5. **Record submission**: Auto-save to server on COMPLETE (POST /records)
   - Anonymous by default (nickname input optional)
   - Falls back to localStorage-only if API fails

**UX**: Feed overlay slides from right (like History), themed as "다른 세계의 기록" (Records from Other Worlds). Cards are styled as "parchment scrolls" matching the game's board-game aesthetic.

**Accessibility**: Feed cards are `<article>` elements, like button has `aria-pressed`, feed region is `role="feed"`.

### Phase 3: Share Card & Social Sharing (P2)

**Files**: `js/share.js` (new), `js/card-worker.js` (new, optional), `js/renderer.js` (modify)

1. **Canvas Image Generation**:
   - 1080×1350 (3:4 aspect, retina) — adapts to 720×900 on low-memory devices
   - Dark gradient background + 3 token emojis + combo text + story excerpt + date + "NOVA POUCH" branding
   - OffscreenCanvas in Web Worker (where supported) to avoid main-thread jank
   - Fallback: main-thread canvas with `requestAnimationFrame`
   - Wait for `document.fonts.ready` before rendering (ensures web fonts load)
   - Native emoji rendering (no twemoji)
   - Target: <200KB PNG, <500ms generation time

2. **Share Panel** (replaces single clipboard button):
   - 3 actions on COMPLETE screen:
     - **Image download** — `URL.createObjectURL(blob)` + `<a download>` (works offline)
     - **Twitter/X** — intent URL with truncated text (250 chars max)
     - **Native share** — `navigator.share()` with image file if supported
   - Clipboard copy remains as secondary action

3. **Memory**: Canvas cleanup after blob extraction (set width/height to 0). Worker self-closes.

**UX**: Share card styled as a "field journal page" — parchment texture, serif font, hand-drawn border feel. The card is a collectible artifact, not a social media graphic.

### Phase 4: Polish & Edge Cases (P3)

- Offline indicator pill (informational only, doesn't block anything)
- Feed error states: offline → "오프라인 모드", API error → retry button, empty → "첫 번째 기록을 남겨보세요"
- `online`/`offline` event listeners for opportunistic refresh
- Feed DOM cap at 100 cards
- Passive event listeners audit

---

## State Machine Changes (Consolidated)

```javascript
// New ACTIONS (add to existing)
SET_DAILY_TOKENS: 'SET_DAILY_TOKENS',   // payload: { red, blue, green }
SUBMIT_RECORD: 'SUBMIT_RECORD',         // payload: { recordId }

// State additions to createInitialState()
dailyTokens: { red: null, blue: null, green: null },
recordId: null,        // server-assigned record ID after submission
```

No new PHASES. Feed uses overlay pattern (not a phase).

---

## New Files Summary

| File | Size Est. | Phase |
|------|-----------|-------|
| `js/api.js` | ~0.8KB | P0 |
| `js/daily-tokens.js` | ~1.2KB | P0 |
| `js/daily.js` | ~1.5KB | P0 |
| `js/feed.js` | ~3KB | P1 |
| `js/share.js` | ~2KB | P2 |
| `js/card-worker.js` | ~1KB | P2 (optional) |
| `css/feed.css` | ~2KB | P1 |
| **Total** | **~11.5KB raw, ~6.5KB gzipped** | |

## Modified Files

| File | Changes | Phase |
|------|---------|-------|
| `js/state.js` | +2 actions, +2 state fields | P0 |
| `js/pouch.js` | Use `getDailyToken()` instead of `getRandomToken()` | P0 |
| `js/app.js` | Call `prefetchDailyTokens()`, bind feed/share buttons | P0-P2 |
| `js/renderer.js` | Daily banner on IDLE, feed overlay, share panel on COMPLETE | P0-P2 |
| `js/i18n.js` | ~30 new keys (feed, share, daily, error states) | P0-P2 |
| `index.html` | `layer-feed` section, share panel, daily banner element | P0-P2 |

---

## Implementation Order

```
Week 1: P0 — Daily Tokens
  1. daily-tokens.js (token arrays)
  2. api.js (HTTP client)
  3. daily.js (fetch + cache + hash fallback)
  4. state.js changes (SET_DAILY_TOKENS)
  5. pouch.js modification (daily token on draw)
  6. app.js (prefetch on bootstrap)
  7. renderer.js (daily banner on IDLE)
  8. Verify: hash matches server for 10 known dates

Week 2: P1 — Community Feed
  1. feed.js (fetch, pagination, likes)
  2. index.html (layer-feed section)
  3. renderer.js (feed overlay rendering)
  4. css/feed.css
  5. Record auto-submit on COMPLETE
  6. i18n keys for feed
  7. Verify: feed loads, likes toggle, offline shows error

Week 3: P2 — Share Card & Social
  1. share.js (canvas + download + twitter + native share)
  2. card-worker.js (optional OffscreenCanvas)
  3. renderer.js (share panel on COMPLETE)
  4. i18n keys for share
  5. Verify: image generates, downloads work offline, Twitter opens

Week 4: P3 — Polish
  1. Offline indicator
  2. Error state polish
  3. Performance audit (lighthouse, memory profiling)
  4. Cross-browser testing (iOS Safari, Chrome Android)
```

---

## Testing Checklist

### Daily Tokens
- [ ] `hashWithPrime('2026-03-03:red', 31) % 10` same on client and server
- [ ] Game works in airplane mode (local hash)
- [ ] sessionStorage invalidates at midnight UTC
- [ ] Daily banner shows correct date

### Community Feed
- [ ] Feed loads on button click (not on page load)
- [ ] "Load More" appends cards
- [ ] Like toggle: optimistic UI + server reconciliation
- [ ] 5 rapid like taps → 1 API call (debounce)
- [ ] Offline: graceful error, not blank screen
- [ ] Record auto-submits on COMPLETE

### Share Card
- [ ] Image < 200KB, generation < 500ms on mid-range mobile
- [ ] Emoji renders in canvas on iOS Safari + Chrome Android
- [ ] Download works offline
- [ ] `navigator.share()` with image on mobile

### Cross-Cutting
- [ ] Total JS < 30KB gzipped
- [ ] Page load to interactive < 1.5s on 3G
- [ ] Memory < 100MB after 10 share card generations
- [ ] Existing E2E test (`test-flow.mjs`) still passes
