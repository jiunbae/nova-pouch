# R01 Implementation Notes — Claude Agent

> Completed: 2026-03-02
> Files: 9 files (Task 1~9)

---

## Created Files

| # | File | Task | Description |
|---|------|------|-------------|
| 1 | `index.html` | Task 1 | SPA entry, 6 screen sections, 4 CSS links, app.js module load |
| 2 | `css/main.css` | Task 2 | CSS variables, reset, body, buttons, forms, star rating, glass-card |
| 3 | `css/pouch.css` | Task 3 | Pouch layout, 3 color variants, glassmorphism, idle/shake/open animations |
| 4 | `css/token.css` | Task 4 | Token card styles, glow, rise/flip/pulse animations, difficulty stars |
| 5 | `css/screens.css` | Task 5 | 6 screen layouts, mobile/tablet/desktop media queries, reduced motion |
| 6 | `js/tokens.js` | Task 6 | TOKEN_REGISTRY (60 tokens), getRandomToken, formatCombo, calculateDifficulty |
| 7 | `js/state.js` | Task 7 | GameState singleton, observer pattern, 8 phases, 13 actions, dispatch/subscribe |
| 8 | `js/renderer.js` | Task 8 | DOM caching, screen switching, 6 render functions, state subscription |
| 9 | `js/utils.js` | Task 9 | weightedPick, shuffleArray, formatDate, generateId, debounce, clamp, delay |

---

## Architecture Decisions

### State Management (state.js)
- **Observer pattern**: `subscribe(listener)` returns an unsubscribe function.
- **Dispatch-based**: All mutations go through `dispatch(action, payload)`. During animation (`isAnimating === true`), only `SET_ANIMATING` is allowed.
- **Phase transitions**: Encoded in the reducer via `NEXT_PHASE_AFTER_CONFIRM` map: red -> blue -> green -> REVIEW.
- **Singleton export**: `gameState` instance is exported directly. No factory needed for MVP.

### Renderer (renderer.js)
- **No imports from pouch.js, history.js, or app.js** — renderer only imports `state.js`, `tokens.js`, `utils.js`.
- **History data injection**: `initRenderer` accepts an optional `historyLoader` callback so app.js can provide history data without renderer depending on history.js.
- **DOM cache**: All getElementById/querySelector calls happen once in `cacheDOM()`.
- **Exported helpers**: `renderDrawnToken`, `updateCompleteButton`, `renderStarRating` are exported so pouch.js can use them during animation sequences.

### Token Data (tokens.js)
- **60 tokens total**: 20 red, 20 blue, 20 green — all inline, no external JSON.
- **Weighted random**: Higher difficulty tokens are rarer. Weight = `4 - difficulty` (diff 1 = weight 3, diff 3 = weight 1).
- **formatCombo**: Pattern is `"{blue.label}, {green.label} {red.label}"` (e.g., "감정을 읽는, 물에 녹는 시계").
- **Difficulty grading**: Sum 3=1star, 4=2stars, 5=3stars, 6=4stars, 7-9=5stars.

### CSS Design System
- **CSS Variables**: All colors, spacing, typography, and radii are tokenized in `:root`.
- **Glassmorphism**: Consistent `backdrop-filter: blur(16px)` + semi-transparent backgrounds.
- **Colorblind patterns**: Each pouch has a unique pattern overlay (dots for red, stripes for blue, grid for green).
- **Responsive breakpoints**: 0-479px (mobile, vertical stack), 480-767px (tablet), 768px+ (desktop).
- **`prefers-reduced-motion`**: All animations instantly skip.
- **Minimum touch target**: All interactive elements are at least 44x44px (`min-height: 48px` on buttons).
- **Safe area**: `env(safe-area-inset-*)` applied on #app padding.

### HTML Structure (index.html)
- 6 screen sections: `#screen-idle`, `#screen-drawing`, `#screen-review`, `#screen-writing`, `#screen-complete`, `#screen-history`.
- Only `#screen-idle` has `.active` initially.
- All buttons have `aria-label` attributes.
- Token reveal area has `aria-live="polite"`.
- Fonts loaded: Pretendard Variable (UI) + Nanum Myeongjo (narrative).
- Only `js/app.js` is loaded via `<script type="module">`.

---

## Integration Points for Codex Agent

### app.js should:
1. Import `gameState`, `ACTIONS` from `./state.js`
2. Import `initRenderer` from `./renderer.js`
3. Import `getRandomToken` from `./tokens.js`
4. Call `initRenderer(gameState, historyLoaderFn)` on DOMContentLoaded
5. Bind button click events to `gameState.dispatch(...)`
6. Textarea `input` event should call `gameState.dispatch(ACTIONS.UPDATE_STORY, value)` and update char count

### pouch.js should:
1. Import `gameState`, `ACTIONS` from `./state.js`
2. Import `getRandomToken` from `./tokens.js`
3. Import `renderDrawnToken` from `./renderer.js` (for animation sequence)
4. Use `gameState.dispatch(ACTIONS.SET_ANIMATING, true/false)` to lock/unlock input
5. Use `gameState.dispatch(ACTIONS.DRAW_TOKEN, { pouch, token })` after animation
6. The drawing pouch button ID is `#drawing-pouch`, data-pouch attribute indicates current type

### history.js should:
1. Export `loadHistory()`, `saveSession()`, `deleteAllHistory()`, `getStats()`
2. app.js passes `loadHistory` as the `historyLoader` parameter to `initRenderer`

### DOM IDs for event binding:
- `#btn-start` — Start game
- `#btn-confirm-token` — Confirm drawn token
- `#btn-redraw` — Redraw current token
- `#btn-write` — Go to writing screen
- `#btn-retry` — Restart from review
- `#btn-back-review` — Back to review from writing
- `#input-world-name` — World name input
- `#input-story` — Story textarea
- `#btn-complete` — Complete writing
- `#star-rating .star[data-value]` — Star rating buttons
- `#btn-restart` — New game from complete
- `#btn-share` — Share (clipboard)
- `#btn-history-idle` / `#btn-history-complete` — Open history
- `#btn-back-home` — Back to idle from history
- `#btn-delete-all` — Delete all history
- `#drawing-pouch` — The active pouch to tap during drawing phase
