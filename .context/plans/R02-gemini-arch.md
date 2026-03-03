I will begin by investigating the Nova Pouch codebase to understand its current architecture, module dependencies, and state management, and then explore the `jiun-api` backend to align the integration plan with the existing API structure.
I will now examine the core modules of Nova Pouch to understand their implementation details and then explore the `jiun-api` directory to identify the necessary endpoints for the new features.
I will now examine `js/app.js` and `js/renderer.js` to understand how the application is initialized and how the UI is rendered, which will help in planning the integration of the new features.
I will now search for "fetch" or "api" in the codebase to see if there are any existing API calls or references to `jiun-api`, which will help in planning the integration.
I will now examine `index.html` to identify potential locations for the new sections and overlays, such as the community feed and share preview, to ensure they fit seamlessly into the existing UI structure.
Based on the analysis of the current vanilla JS architecture (State Machine + Observer pattern), here is the architectural plan for integrating the four new features.

---

# Nova Pouch: Feature Integration Plan

## 1. Module Architecture & Dependency Graph

To maintain modularity, we will introduce 4 new service/logic modules and 1 new API module.

### New Module Directory Structure
```bash
js/
├── api.js         # Centralized jiun-api communication
├── feed.js        # Community feed logic (pagination, like handling)
├── shareImage.js  # Canvas drawing logic for social cards
└── social.js       # Web Share API & Clipboard wrappers
```

### Dependency Graph
*   **`app.js`**: The orchestrator. Imports `api.js`, `feed.js`, `shareImage.js`, and `social.js`.
*   **`feed.js`**: Depends on `api.js` and `state.js` to dispatch feed updates.
*   **`shareImage.js`**: Pure utility. Depends on `tokens.js` for emoji/label lookups.
*   **`renderer.js`**: Reacts to `state.js`. Will be updated to handle the new `FEED` phase and `DAILY` mode UI.

---

## 2. State Machine Extensions (`js/state.js`)

We need to extend the global state to handle async data and the new view.

### New PHASES & ACTIONS
```javascript
export const PHASES = {
  // ... existing
  FEED: 'FEED',           // Browsing community stories
};

export const ACTIONS = {
  // ... existing
  SET_DAILY_MODE: 'SET_DAILY_MODE',   // Toggle between random and daily
  LOAD_DAILY_TOKENS: 'LOAD_DAILY_TOKENS',
  LOAD_FEED: 'LOAD_FEED',
  APPEND_FEED: 'APPEND_FEED',
  LIKE_STORY: 'LIKE_STORY'
};
```

### State Schema Additions
```javascript
function createInitialState() {
  return {
    // ... existing
    isDailyMode: false,
    dailyTokens: { red: null, blue: null, green: null },
    feed: {
      items: [],
      page: 1,
      isLoading: false
    }
  };
}
```

---

## 3. Specific Module Signatures

### `js/api.js` (The Bridge to `jiun-api`)
```javascript
/**
 * @typedef {Object} StoryData
 * @property {string} worldName
 * @property {string} userStory
 * @property {Object} tokens
 */

export const ApiService = {
  async fetchDailyTokens() { /* GET /tokens/daily */ },
  async fetchFeed(page = 1) { /* GET /stories?page=${page} */ },
  async postStory(storyData) { /* POST /stories */ },
  async toggleLike(storyId) { /* POST /stories/${storyId}/like */ }
};
```

### `js/shareImage.js` (Canvas Engine)
```javascript
/**
 * Generates a shareable PNG blob from the current state
 * @param {Object} state - Current gameState snapshot
 * @returns {Promise<Blob>}
 */
export async function generateShareBlob(state) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  // 1. Draw Background (Nova Pouch theme)
  // 2. Draw Token Emojis and Labels
  // 3. Render User Story text with wrapping logic
  // 4. Add Nova Pouch Logo/Watermark
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
```

---

## 4. Integration Points in Existing Modules

### `js/tokens.js` (Deterministic Logic)
Update `getRandomToken` or add `getDailyToken`:
```javascript
export function getDailyToken(pouchType, dailyData) {
  // Instead of weightedPick, return the token matching dailyData[pouchType]
  return TOKEN_REGISTRY.pouches[pouchType].tokens.find(t => t.id === dailyData[pouchType]);
}
```

### `js/app.js` (Social Sharing flow)
Update `bindShareButton`:
```javascript
async function handleShare() {
  const state = gameState.getState();
  const imageBlob = await generateShareBlob(state);
  const file = new File([imageBlob], 'nova-pouch.png', { type: 'image/png' });

  if (navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: 'Nova Pouch Record',
      text: buildShareText(state)
    });
  } else {
    // Fallback to clipboard text + image download
    await downloadImage(imageBlob);
  }
}
```

---

## 5. UI & CSS Organization

### `index.html` Additions
1.  **Feed Layer**: A new `<section id="layer-feed" class="layer">` similar to `layer-history`.
2.  **Daily Toggle**: A "Daily Discovery" button on `layer-idle`.
3.  **Share Preview**: A hidden `<canvas id="share-canvas">` for off-screen rendering.

### CSS Organization
*   **`css/feed.css`**: New file. Focus on masonry or list layout for community stories. Use CSS variables for token colors.
*   **`css/screens.css`**: Add `.layer-feed` visibility logic (managed by `renderer.js`).

## 6. Maintainability Strategy

1.  **Observer Decoupling**: The Feed logic (`feed.js`) should subscribe to the `FEED` phase and trigger its own `ApiService` calls, keeping `app.js` clean.
2.  **Canvas Drawing Abstraction**: In `shareImage.js`, use a helper for "Multi-line Text Wrapping" as Canvas doesn't handle this natively.
3.  **Error Boundaries**: Since we are introducing network calls, `renderer.js` must handle `isLoading` and `error` states for the Feed and Daily Token fetches.
