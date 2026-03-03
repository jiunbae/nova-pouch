# R01 Integration Report

## Summary

Verified and fixed integration between Claude-authored files (index.html, css/*, tokens.js, state.js, renderer.js, utils.js) and Codex-authored files (pouch.js, history.js, app.js). All seven JS files pass `node --check` after fixes.

## Issues Found & Fixed

### 1. app.js imported non-exported `render` from renderer.js

**Problem:** `app.js` imported `render` which is a private function in `renderer.js`. It also redundantly subscribed to state and called `render(state)` directly.

**Fix:** Removed `render` import. Passed `loadHistory` as `historyLoader` argument to `initRenderer()` so the renderer handles rendering on state changes internally. Removed redundant subscribe/render calls from bootstrap.

### 2. DOM selector mismatches (app.js vs index.html)

**Problem:** Codex-authored app.js guessed element IDs that did not match Claude's HTML.

| app.js selector | Actual HTML ID |
|---|---|
| `#btn-start-game` | `#btn-start` |
| `#btn-start-writing` | `#btn-write` |
| `#btn-view-history` | `#btn-history-idle`, `#btn-history-complete` |
| `#btn-delete-history` | `#btn-delete-all` |
| `#user-story` | `#input-story` |
| `#world-name` | `#input-world-name` |
| `#story-char-count` | `#char-count` |
| `#history-total` | `#stats-total` |
| `#history-average` | `#stats-avg-rating` |
| `.rating-star[data-value]` | `#star-rating .star` (with `data-value`) |

**Fix:** Updated all queryFirst/queryAll selectors to list the correct HTML IDs first, keeping Codex's original selectors as fallbacks.

### 3. Missing button bindings

**Problem:** HTML has `#btn-back-review` (writing -> review), `#btn-back-home` (history -> idle), and `#btn-retry` (review -> restart) that had no bindings in app.js.

**Fix:** Added `bindButtons` calls for BACK_TO_REVIEW, BACK_HOME, and included `#btn-retry` in the restart binding.

### 4. Action name mismatches (app.js/pouch.js vs state.js)

**Problem:** Dispatched action strings did not match `ACTIONS` constants in state.js.

| Dispatched | Expected by state.js |
|---|---|
| `SET_WORLD_NAME` | `UPDATE_WORLD_NAME` |
| `SET_USER_STORY` | `UPDATE_STORY` |
| `RATE` | (removed, `SET_RATING` already dispatched) |
| `REDRAW` (pouch.js) | `REDRAW_TOKEN` |
| `SET_IS_ANIMATING` (pouch.js) | (removed, redundant) |
| `SET_UI_STATE` (pouch.js) | (removed, redundant) |

**Fix:** Corrected all action strings. Removed spurious fallback dispatches from pouch.js `setAnimating`.

### 5. Payload key mismatch (pouch.js vs state.js)

**Problem:** pouch.js dispatched `{ pouchType, token }` but state.js reducer destructures `{ pouch, token }`.

**Fix:** Changed pouch.js to dispatch `{ pouch: pouchType, token }`.

### 6. Function argument shape mismatches

**Problem:** `formatCombo()` and `calculateDifficulty()` expect `{ red, blue, green }` objects but app.js passed arrays of tokens.

**Fix:** Changed `buildShareText`, `buildSessionCombo`, and `calculateDifficultySafely` to pass the tokens object `{ red, blue, green }` directly. Also updated `calculateDifficultySafely` to check for `result.sum` (the actual key returned by `calculateDifficulty`).

### 7. Token slot selectors (pouch.js vs index.html)

**Problem:** pouch.js `findTokenSlot` and `findTokenCard` searched for elements like `#token-slot-red`, `[data-token-reveal]` etc. that don't exist in the HTML. The actual element is `#drawn-token-slot`.

**Fix:** Added `#drawn-token-slot` to both selector fallback lists. Also added `#drawing-pouch[data-pouch="..."]` to `findPouchElement`.

### 8. Redraw flow coordination (pouch.js vs state.js)

**Problem:** pouch.js dispatched a premature `REDRAW` action (wrong name, no token) before running the draw animation. Then `runDrawSequence` dispatched `DRAW_TOKEN`, but state.js `REDRAW_TOKEN` expects the new token in the payload.

**Fix:** Removed the premature dispatch. Added `isRedraw` flag to `runDrawSequence` so it dispatches `REDRAW_TOKEN` (with the actual drawn token) instead of `DRAW_TOKEN` when it's a redraw operation.

## Verification

All seven JS files pass `node --check`:
- js/app.js
- js/history.js
- js/pouch.js
- js/renderer.js
- js/state.js
- js/tokens.js
- js/utils.js

## Files Modified

- `/js/app.js` -- 8 categories of fixes
- `/js/pouch.js` -- 4 categories of fixes
- No changes needed in: `state.js`, `renderer.js`, `tokens.js`, `utils.js`, `history.js`, `index.html`
