# R02 UX Plan: Nova Pouch Frontend Integration

> **Scope:** Daily Token, Community Feed, Image Generation, Social Sharing
> **Perspective:** UX/User Flow specialist
> **Base:** Existing codebase analysis (index.html, state.js, renderer.js, i18n.js, css/*)

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Feature 1: Daily Token Flow](#2-feature-1-daily-token-flow)
3. [Feature 2: Community Feed](#3-feature-2-community-feed)
4. [Feature 3: Image Generation (Shareable Card)](#4-feature-3-image-generation-shareable-card)
5. [Feature 4: Social Sharing](#5-feature-4-social-sharing)
6. [Navigation Architecture](#6-navigation-architecture)
7. [i18n Strategy](#7-i18n-strategy)
8. [Edge Cases & Error States](#8-edge-cases--error-states)
9. [Accessibility Considerations](#9-accessibility-considerations)
10. [Implementation Priority](#10-implementation-priority)

---

## 1. Design Principles

### Guiding Philosophy

Nova Pouch's existing UX is built around a **board-game metaphor** with warm, tactile
aesthetics (parchment backgrounds, stitched pouches, gold accents). All four new
features must respect this established tone.

**Core UX principles for R02:**

1. **Ceremony over efficiency** -- The pouch draw is a ritual. Daily tokens should
   amplify this feeling, not shortcut it.
2. **Record, don't create** -- The player is an Archivist. Community feed should
   present entries as "discovered records from parallel worlds," not "user-generated
   content."
3. **Analog warmth in a digital frame** -- Shareable cards should look like
   physical artifacts (postcards, field journal pages), not social media graphics.
4. **Friction-appropriate sharing** -- Sharing should be easy but never pushy. One
   tap to share; zero pop-ups begging for it.

### Existing Interaction Patterns to Preserve

| Pattern | Where Used | Must Maintain |
|---------|-----------|---------------|
| Pouch tap -> shake -> open -> reveal | Drawing phase | Yes -- daily tokens reuse this |
| Progress dots (4 steps) | Game layer header | Extend to 5 if daily adds a step |
| Continuous scroll flow | Post-draw (review/writing/complete) | Feed should feel similar |
| Layer overlay (slide from right) | History panel | Community feed uses same pattern |
| Ghost/Secondary/Primary button hierarchy | All CTAs | Consistent across new features |
| `narrative-font` for story content | Writing, complete card | Feed cards, shareable image |
| `data-i18n` attribute system | All UI text | All new strings |

---

## 2. Feature 1: Daily Token Flow

### 2.1 Concept

Every player gets the **same three tokens** on a given day. The draw animation
still plays -- the result is predetermined, but the player does not know that
until each token is revealed. This creates a shared constraint that enables the
Community Feed (everyone writes about the same combination).

### 2.2 User Journey

```
IDLE screen
  |
  |-- [Player taps "Start" / "Today's Draw"]
  |
  v
DAILY BANNER (new element, subtle)
  Shows: "Day 47 -- All archivists receive the same fragments today"
  |
  |-- Banner auto-fades after 2s, or dismissed by tap
  |
  v
DRAWING_RED (unchanged animation sequence)
  Pouch tap -> shake -> open -> reveal
  Token is predetermined by daily seed
  "Redraw" button is HIDDEN (daily mode = no redraws)
  |
  v
DRAWING_BLUE (same)
  |
  v
DRAWING_GREEN (same)
  |
  v
REVIEW (unchanged)
  Shows the combination + "Today's combination" badge
  |
  v
WRITING (unchanged)
  |
  v
COMPLETE (enhanced)
  New: "See what other archivists recorded" CTA
  New: "Share your record" with image card
```

### 2.3 Key UX Decisions

#### The Tap Must Still Feel Exciting

Even though the daily token is fixed, the player should not feel cheated. The
reveal timing is the critical variable, not the outcome.

**Technique:** Keep the exact same animation pipeline from `pouch.js`:
- `pouch--shaking` (500ms)
- Token rise (800ms)
- Token flip (320ms)
- Reveal

The player has never seen today's token before, so it is still a genuine reveal.
The fact that others got the same result only matters AFTER the draw is complete.

#### When to Reveal "Daily" Nature

- **NOT before the draw.** If you tell the player beforehand that the result is
  fixed, it kills anticipation.
- **At the REVIEW step.** After all three tokens are revealed, show a subtle
  badge: "Today's Combination" with a calendar icon. This is the first hint
  that this is a shared experience.
- **At the COMPLETE step.** The "See what others recorded" CTA connects the
  dots -- "Wait, others got this too?"

#### No Redraws in Daily Mode

Since every player must get the same tokens, redraws are disabled. To avoid
confusion:
- Hide the "Redraw" button entirely (not disabled -- hidden)
- Replace the sub-instruction text:
  - KO: "오늘의 파편이 나타납니다" (Today's fragment appears)
  - EN: "Today's fragment is revealed"

### 2.4 "Today's Theme" Messaging

A lightweight banner appears at the start of the daily session:

```
+--------------------------------------------------+
|  +---------+                                      |
|  | CAL ICN |  Day 47                              |
|  +---------+  오늘의 파편은 모든 기록자에게         |
|               동일하게 주어집니다.                   |
|                                                    |
|               Today's fragments are shared         |
|               among all archivists.                |
+--------------------------------------------------+
```

**Wireframe -- Daily Banner (within Game layer, above progress dots):**

```
+--------------------------------------------------+
|  [lang toggle]                            [EN/KO] |
|                                                    |
|  +----------------------------------------------+ |
|  |  #47  2026-03-03                              | |
|  |  오늘 모든 기록자가 같은 파편을 받습니다.       | |
|  +----------------------------------------------+ |
|                                                    |
|          * --- * --- * --- *    (progress dots)    |
|                                                    |
|         [  pouch draw area continues...  ]         |
+--------------------------------------------------+
```

- The banner uses `.glass-card` styling (existing pattern)
- It appears with `step-enter` animation (350ms bounce-in)
- Auto-collapses after 2 seconds into a minimal "Day 47" pill in the top-left
- Tapping the pill re-expands it

### 2.5 Loading / Seed Resolution

The daily seed needs to be fetched (or derived). Two approaches:

**Option A: Client-side deterministic seed (no network)**
- Seed = `YYYY-MM-DD` string, hashed to pick token indices
- Zero loading time, works offline
- Risk: tech-savvy users can predict tokens

**Option B: Server-provided daily tokens (network)**
- API call on start: `GET /api/daily`
- Requires loading state

**Recommended: Option A for MVP, Option B when backend exists.**

If Option B, the loading state:

```
+--------------------------------------------------+
|                                                    |
|        (pouch idle animation, slightly dimmed)     |
|                                                    |
|         "차원의 기록을 불러오는 중..."               |
|         "Loading dimensional records..."           |
|                                                    |
|         [subtle shimmer on pouch border]           |
|                                                    |
+--------------------------------------------------+
```

- Loading indicator: the pouches gently glow (reuse `pouch-pulse` keyframe)
- If load fails: fallback to random mode with a toast:
  "오늘의 파편을 불러올 수 없습니다. 자유 탐험 모드로 전환합니다."

### 2.6 State Changes

New state fields:

```javascript
// Added to gameState
{
  dailyMode: true | false,        // is this a daily session?
  dailySeed: 'YYYY-MM-DD' | null, // current daily seed
  dailyCompleted: false,          // has today's daily been completed?
}
```

New phase considerations:
- `DRAWING` phase: `state.dailyMode` determines whether redraws are available
- `COMPLETE` phase: if `state.dailyMode`, show community CTA

### 2.7 Daily Mode vs. Free Mode Toggle

After completing the daily, or if the player wants a random experience:

```
IDLE screen (daily completed state):
+--------------------------------------------------+
|                                                    |
|           NOVA POUCH                               |
|                                                    |
|     +------------------------------------------+  |
|     |  Today's record complete!                 |  |
|     |  "물에 녹는 투명한 시계"                    |  |
|     |  [See Community Records]                  |  |
|     +------------------------------------------+  |
|                                                    |
|     [  Free Exploration  ]  (btn--primary)         |
|     [  Archive  ]           (btn--ghost)           |
|                                                    |
+--------------------------------------------------+
```

- "Free Exploration" starts a normal random session (no daily restrictions)
- The daily summary card shows the combo and links to community feed

---

## 3. Feature 2: Community Feed

### 3.1 Concept

After all players complete the same daily tokens, they can browse what others
wrote. This is the "See what other archivists recorded" experience.

### 3.2 Where It Fits in the Game Flow

**Entry points (3 total):**

1. **COMPLETE step** -- "다른 기록자들의 세계 보기" button (primary entry)
2. **IDLE screen** -- "오늘의 기록들" button (if daily is completed)
3. **History overlay** -- future enhancement: link from a daily session card

**Architecture: The Community Feed is a new layer overlay**, similar to the
existing History overlay. It slides in from the right.

```
Layer Stack:
  layer-idle          (base)
  layer-game          (base, replaces idle)
  layer-history       (overlay, slides right)
  layer-community     (overlay, slides right)   <-- NEW
```

### 3.3 User Journey

```
COMPLETE step
  |
  |-- [Player taps "See Community Records"]
  |
  v
COMMUNITY FEED OVERLAY (slides in from right)
  |
  |-- Header: "Today's Records" + date + back button
  |-- Stats bar: "47 archivists recorded today"
  |-- Feed: scrollable list of record cards
  |-- Each card shows: combo, story excerpt, star rating
  |
  |-- [Player taps a card]
  |
  v
RECORD DETAIL (expand in-place or modal)
  |
  |-- Full story text
  |-- Like button (heart)
  |-- "Share this record" option
  |
  |-- [Player taps Back]
  |
  v
COMMUNITY FEED (returns to scroll position)
  |
  |-- [Player taps <- Back]
  |
  v
Previous screen (COMPLETE or IDLE)
```

### 3.4 Feed Layout

**Card-based vertical feed** -- consistent with existing History card design.

```
+--------------------------------------------------+
| <- 돌아가기            오늘의 기록들                |
|                                                    |
| +----------------------------------------------+  |
| |  47명의 기록자가 오늘의 세계를 기록했습니다.      |  |
| +----------------------------------------------+  |
|                                                    |
| +----------------------------------------------+  |
| |  Anonymous Archivist #23              4 hours |  |
| |                                               |  |
| |  "이 세계에서 시계는 주인의 감정에 따라          |  |
| |   투명해지며, 비가 오면 서서히 녹아내려          |  |
| |   시간의 의미를 잃는다..."                      |  |
| |                                               |  |
| |  +----+  +-----+  +------+                    |  |
| |  | clock| |trans| |melts |                    |  |
| |  +----+  +-----+  +------+                    |  |
| |                                               |  |
| |  Rating: 4 stars      [heart] 12              |  |
| +----------------------------------------------+  |
|                                                    |
| +----------------------------------------------+  |
| |  Anonymous Archivist #41              2 hours |  |
| |                                               |  |
| |  "투명한 시계는 이 도시의 감시 도구다.           |  |
| |   비가 오면 모두의 시간이 리셋되어..."           |  |
| |                                               |  |
| |  Rating: 5 stars      [heart] 28              |  |
| +----------------------------------------------+  |
|                                                    |
|              [ Load More ]                         |
+--------------------------------------------------+
```

**Card structure (ASCII wireframe detail):**

```
+----------------------------------------------+
|  HEADER ROW                                   |
|  [Anonymous name]                  [time ago] |
|                                               |
|  STORY EXCERPT (3 lines, truncated)           |
|  "이 세계에서는 감정이 시간의 화폐가 되어..."    |
|  ...more                                      |
|                                               |
|  TOKEN CHIPS ROW                              |
|  [red chip] [blue chip] [green chip]          |
|                                               |
|  FOOTER ROW                                   |
|  stars: 4/5         [heart icon] 12 likes     |
+----------------------------------------------+
```

### 3.5 Anonymous vs. Named

**Default: Anonymous with generated identifiers.**

Each submission is labeled as:
- KO: "기록자 #23" (Archivist #23)
- EN: "Archivist #23"

The number is a daily index (23rd person to submit today). This preserves
anonymity while giving a sense of community scale.

**Future enhancement:** Optional nickname (stored in localStorage, never
required). If set:
- KO: "별빛수집가의 기록" (Starlight Collector's record)
- EN: "Starlight Collector's record"

### 3.6 Like Interaction

A simple heart-based like system:

- One like per record per device (localStorage tracking)
- Tap heart: fills with gold color (matches `--color-gold` theme)
- Counter increments with a brief scale animation
- No dislike, no comments (keeps it positive and simple)

**Like button states:**

```
[ Heart outline ] 12     -- not liked
[ Heart filled  ] 13     -- liked (gold color, scale bounce)
```

Animation: `transform: scale(1.3)` for 200ms, then back to `scale(1)`.

### 3.7 Empty States

**No records yet today:**

```
+----------------------------------------------+
|                                               |
|    (illustration: three pouches floating)     |
|                                               |
|    아직 오늘의 기록이 없습니다.                  |
|    첫 번째 기록자가 되어 보세요!                 |
|                                               |
|    No records yet today.                      |
|    Be the first archivist!                    |
|                                               |
|    [ Start Today's Draw ]                     |
|                                               |
+----------------------------------------------+
```

**Network error / feed unavailable:**

```
+----------------------------------------------+
|                                               |
|    기록을 불러올 수 없습니다.                    |
|    잠시 후 다시 시도해 주세요.                   |
|                                               |
|    [ Retry ]                                  |
|                                               |
+----------------------------------------------+
```

### 3.8 Feed Sorting & Pagination

- Default sort: **Most recent** (newest first)
- Secondary sort option: **Most liked** (toggle button in header)
- Pagination: "Load More" button at bottom (not infinite scroll -- keeps
  intentionality)
- Load 20 records per page

### 3.9 Navigation Back to Game

The community feed overlay must preserve the underlying game state, exactly
like the existing History overlay:

```javascript
// New actions
ACTIONS.VIEW_COMMUNITY = 'VIEW_COMMUNITY';
ACTIONS.CLOSE_COMMUNITY = 'CLOSE_COMMUNITY';

// State
case ACTIONS.VIEW_COMMUNITY:
  s._prevPhase = s.phase;
  s.phase = PHASES.COMMUNITY;
  break;

case ACTIONS.CLOSE_COMMUNITY:
  s.phase = s._prevPhase || PHASES.IDLE;
  s._prevPhase = null;
  break;
```

Browser back button integration: add a `history.pushState` entry when opening
the community feed, matching the existing pattern in `initHistoryNavigation`.

---

## 4. Feature 3: Image Generation (Shareable Card)

### 4.1 Concept

Generate a visually rich image card that captures the player's record. This card
is the primary artifact for social sharing. It should look like a **physical
artifact** -- a page from a field journal, a postcard from another dimension.

### 4.2 Card Dimensions

Support three formats, generated from the same template with layout adjustments:

| Format | Dimensions | Aspect Ratio | Use Case |
|--------|-----------|--------------|----------|
| **Story** | 1080 x 1920 px | 9:16 | Instagram/TikTok Stories, mobile wallpaper |
| **Square** | 1080 x 1080 px | 1:1 | Instagram feed, Twitter, KakaoTalk |
| **Wide** | 1200 x 628 px | ~1.91:1 | Twitter card, Facebook OG, link preview |

**Default generation: Square (1080x1080).** Story and Wide are secondary options
accessible via a format selector.

### 4.3 Visual Design

The card should match the board-game theme: warm parchment, gold accents,
handwritten-feeling typography.

**Card Layout (Square 1080x1080):**

```
+--------------------------------------------------+
|  (Parchment texture background)                   |
|  (Subtle cross-hatch pattern from main.css)       |
|                                                    |
|  +----------------------------------------------+ |
|  |        NOVA POUCH                             | |
|  |        (gold, letter-spaced, 24px)            | |
|  +----------------------------------------------+ |
|                                                    |
|  TOKEN ROW (centered)                              |
|  +--------+  +--------+  +--------+               |
|  | emoji  |  | emoji  |  | emoji  |               |
|  | label  |  | label  |  | label  |               |
|  | (red)  |  | (blue) |  | (green)|               |
|  +--------+  +--------+  +--------+               |
|                                                    |
|  COMBINATION TEXT (narrative font, centered)        |
|  "물에 녹는 투명한 시계"                             |
|  (18px, color-text)                                |
|                                                    |
|  DIVIDER LINE (gold, thin, ornamental)             |
|  -------- * --------                               |
|                                                    |
|  STORY TEXT (narrative font, left-aligned)          |
|  "이 세계에서 시계는 주인의 감정에 따라              |
|   투명해지며, 비가 오면 서서히 녹아내려              |
|   시간의 의미를 잃는다. 사람들은 시간을              |
|   감정의 무게로 측정한다..."                         |
|  (14px, max 6 lines, ellipsis if longer)           |
|                                                    |
|  FOOTER                                            |
|  +----------------------------------------------+ |
|  |  Rating: 4/5 stars                            | |
|  |  Day 47 -- 2026-03-03                         | |
|  |  novapouch.app                    [QR small]  | |
|  +----------------------------------------------+ |
|                                                    |
+--------------------------------------------------+
```

**Card Layout (Story 1080x1920):**

```
+----------------------------+
|                            |
|  (more vertical breathing  |
|   room at top)             |
|                            |
|      NOVA POUCH            |
|                            |
|   +------+------+------+  |
|   | emoji| emoji| emoji|  |
|   |  red | blue |green |  |
|   +------+------+------+  |
|                            |
|  "물에 녹는 투명한 시계"     |
|                            |
|  -------- * --------       |
|                            |
|  (Story text, up to 10     |
|   lines, more generous     |
|   line height)             |
|                            |
|  "이 세계에서 시계는..."     |
|  "투명해지며, 비가 오면..."  |
|  "시간의 의미를 잃는다..."   |
|  (etc.)                    |
|                            |
|                            |
|  -------- * --------       |
|                            |
|  Day 47 -- 2026-03-03      |
|  Rating: 4/5               |
|                            |
|  novapouch.app             |
|                            |
+----------------------------+
```

### 4.4 Information Hierarchy

1. **Brand** -- "NOVA POUCH" at top (establishes origin)
2. **Tokens** -- The three emoji + labels (visual hook, most eye-catching)
3. **Combination text** -- The natural-language combo string
4. **Story excerpt** -- The player's writing (the soul of the card)
5. **Metadata** -- Rating, date, day number (context)
6. **Attribution** -- URL or QR code (tiny, bottom corner)

### 4.5 Typography on Card

| Element | Font | Size (1080px) | Weight | Color |
|---------|------|--------------|--------|-------|
| Brand | Pretendard | 28px | 800 | gold (#B8860B) |
| Token labels | Pretendard | 16px | 600 | text (#3B2F2F) |
| Combination | Nanum Myeongjo | 22px | 700 | text (#3B2F2F) |
| Story | Nanum Myeongjo | 18px | 400 | text (#3B2F2F) |
| Metadata | Pretendard | 14px | 400 | text-secondary (#7A6B5D) |
| URL | Pretendard | 12px | 400 | text-secondary (#7A6B5D) |

### 4.6 Rendering Approach

Use an **offscreen Canvas** (or html2canvas as a fallback library):

1. Create a `<canvas>` element at the desired dimensions
2. Draw the parchment background texture
3. Render text using `ctx.fillText()` with proper font loading
4. Render token chips as rounded rectangles with emoji
5. Export as PNG via `canvas.toBlob()`

**Why Canvas over DOM-to-image?**
- Consistent rendering across browsers
- No CORS issues with external resources
- Exact pixel control for social media requirements
- Font embedding guaranteed

**Font loading strategy:**
- Wait for `document.fonts.ready` before rendering
- Fallback to system serif/sans-serif if web fonts fail

### 4.7 Card Generation Trigger

The card is generated at the COMPLETE step when the user taps "Share."
It is NOT pre-generated (saves resources for users who never share).

```
User taps [Share] button
  |
  v
Card format selector appears (inline, not modal):
  [ Square ]  [ Story ]  [ Wide ]
  (Square is pre-selected)
  |
  v
Canvas renders in background (~200ms)
Brief shimmer animation on the share button
  |
  v
Share sheet opens (or download starts)
```

### 4.8 Localization of Card Content

The card text follows the current locale:

| Element | KO | EN |
|---------|----|----|
| Brand | NOVA POUCH | NOVA POUCH |
| Combo | "물에 녹는 투명한 시계" | "transparent, dissolves in water clock" |
| Story | (user's text, as-written) | (user's text, as-written) |
| Day label | "47일차" | "Day 47" |
| Rating label | (star icons only) | (star icons only) |

Note: The story text is always in the language the user wrote it in. No
translation. The combo text respects `formatCombo()` locale logic from
`tokens.js`.

---

## 5. Feature 4: Social Sharing

### 5.1 Concept

Sharing is the bridge between the personal game experience and the broader
community. It must feel natural, not transactional.

### 5.2 Share Button Placement

**Primary share button:** COMPLETE step, in the actions row.

Current layout:
```
[ Explore Again ]   (btn--primary)
[ Share ]           (btn--secondary)
[ Archive ]         (btn--ghost)
```

Enhanced layout:
```
[ Explore Again ]   (btn--primary, full width)
[ Share Record  ]   (btn--secondary, full width, with share icon)
[ Community     ]   (btn--secondary, full width)     <-- NEW
[ Archive       ]   (btn--ghost, full width)
```

**Secondary share button:** Inside the Community Feed, on each record card
(share someone else's record).

**Tertiary share button:** History overlay, on each past session card
(share your own past records).

### 5.3 Share Flow -- Primary (Own Record)

```
COMPLETE step
  |
  |-- [User taps "Share Record"]
  |
  v
SHARE OPTIONS (inline expansion below the button, not a modal)
+--------------------------------------------------+
|                                                    |
|  Share as:                                         |
|  +--------+  +--------+  +----------+             |
|  | Image  |  | Text   |  | Link     |             |
|  | Card   |  | Copy   |  | Copy     |             |
|  +--------+  +--------+  +----------+             |
|                                                    |
|  Image format:                                     |
|  ( Square )  ( Story )  ( Wide )                   |
|                                                    |
+--------------------------------------------------+
```

#### Path A: Image Card Share

```
[User taps "Image Card"]
  |
  v
Canvas renders (200ms, shimmer animation)
  |
  |-- Mobile with Web Share API:
  |     navigator.share({ files: [blob] })
  |     -> Native share sheet opens
  |     -> User picks destination (KakaoTalk, Twitter, etc.)
  |
  |-- Desktop / no Web Share:
  |     Image downloads automatically
  |     Toast: "Image saved! / 이미지가 저장되었습니다!"
  |
  v
Done. User returns to COMPLETE step.
```

#### Path B: Text Copy

```
[User taps "Text Copy"]
  |
  v
navigator.clipboard.writeText(shareText)
  |
  v
Toast: "Copied to clipboard / 클립보드에 복사되었습니다"
```

The text format (existing `buildShareText` from `app.js`):
```
+----------------------------------------------+
|  Nova Pouch Record                            |
|  World: (world name)                          |
|  Fragments: "combination text"                |
|  Record: "story text (truncated to 280 chars)"|
|  #NovaPouch #novapouch                       |
+----------------------------------------------+
```

#### Path C: Link Copy

```
[User taps "Link Copy"]
  |
  v
Copies shareable URL to clipboard:
  https://novapouch.app/daily/2026-03-03?ref=share
  |
  v
Toast: "Link copied / 링크가 복사되었습니다"
```

### 5.4 Twitter/X Intent

For direct Twitter sharing, construct a tweet intent URL:

```
https://twitter.com/intent/tweet?text={encodedText}&url={encodedUrl}
```

Where:
- `text`: Truncated share text (280 char limit minus URL length)
- `url`: `https://novapouch.app/daily/2026-03-03`

The Twitter intent opens in a new tab. On mobile, it may open the Twitter app.

**Dedicated Twitter button:** Only shown if the share options panel is expanded.
Positioned as an icon button (Twitter/X logo) next to the text share options.

### 5.5 KakaoTalk Share (Korean market priority)

KakaoTalk sharing via Kakao SDK:

```javascript
Kakao.Share.sendDefault({
  objectType: 'feed',
  content: {
    title: 'Nova Pouch 기록',
    description: combinationText,
    imageUrl: cardImageUrl, // hosted or base64
    link: {
      mobileWebUrl: shareUrl,
      webUrl: shareUrl,
    },
  },
  buttons: [{
    title: '기록 보기',
    link: {
      mobileWebUrl: shareUrl,
      webUrl: shareUrl,
    },
  }],
});
```

**Note:** KakaoTalk share requires the Kakao JS SDK and an app key. If not
available, fall back to link copy with a message:
"카카오톡으로 공유하려면 링크를 복사하여 대화에 붙여넣기 하세요."

### 5.6 Mobile Share Sheet (Web Share API)

The Web Share API is the preferred method on mobile:

```javascript
async function shareRecord(blob, text, url) {
  // Try sharing with image file first
  if (navigator.canShare?.({ files: [new File([blob], 'nova-pouch.png', { type: 'image/png' })] })) {
    await navigator.share({
      title: t('share.shareTitle'),
      text: text,
      url: url,
      files: [new File([blob], 'nova-pouch.png', { type: 'image/png' })],
    });
    return;
  }

  // Fallback: share text + URL only
  if (navigator.share) {
    await navigator.share({
      title: t('share.shareTitle'),
      text: text,
      url: url,
    });
    return;
  }

  // Final fallback: clipboard
  await navigator.clipboard.writeText(text + '\n' + url);
  announce(t('announce.copied'));
}
```

### 5.7 Link Preview (OG Tags)

When sharing a link, the preview card matters. Dynamic OG tags for daily pages:

```html
<!-- For /daily/2026-03-03 -->
<meta property="og:title" content="Nova Pouch - Day 47">
<meta property="og:description" content="오늘의 조합: 물에 녹는 투명한 시계 | 47명의 기록자가 이 세계를 상상했습니다.">
<meta property="og:image" content="https://novapouch.app/api/og/2026-03-03.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="628">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Nova Pouch - Day 47">
<meta name="twitter:description" content="Today's combination: transparent, dissolves in water clock">
<meta name="twitter:image" content="https://novapouch.app/api/og/2026-03-03.png">
```

The OG image should be the Wide format (1200x628) showing the daily combination
without any specific user's story -- just the three tokens and combo text.
This is a server-side generated image (not user-specific).

### 5.8 Share Feedback & Confirmation

After any share action, provide clear feedback:

| Action | Feedback | Duration |
|--------|----------|----------|
| Image downloaded | Toast: "Image saved" | 3s |
| Text copied | Toast: "Copied to clipboard" | 2s |
| Link copied | Toast: "Link copied" | 2s |
| Native share sheet opened | No toast (OS handles it) | -- |
| Share failed | Toast: "Sharing failed. Try copying instead." | 4s |

**Toast component (new):**

```
+--------------------------------------------------+
|                                                    |
|  (game content)                                    |
|                                                    |
|  +----------------------------------------------+ |
|  |  [check icon]  클립보드에 복사되었습니다.       | |
|  +----------------------------------------------+ |
|       ^ toast slides up from bottom, 2s auto-hide |
+--------------------------------------------------+
```

The toast uses:
- Background: `var(--card-bg)` with solid border
- Border: `var(--card-border)`
- Position: fixed bottom, centered, max-width 400px
- Animation: slide up + fade in, then reverse
- z-index: `var(--z-modal)` (above everything)

---

## 6. Navigation Architecture

### 6.1 Updated Layer Stack

```
+--------------------------------------------------+
|  #app                                              |
|                                                    |
|  +-- layer-idle (base)                             |
|  +-- layer-game (base, replaces idle)              |
|  +-- layer-history (overlay)                       |
|  +-- layer-community (overlay)        <-- NEW      |
|  +-- toast-container (fixed, z-modal) <-- NEW      |
|                                                    |
+--------------------------------------------------+
```

### 6.2 Updated Phase Diagram

```
            +------+
            | IDLE |
            +--+---+
               |
     +---------+-----------+
     |                     |
  [Start]          [View Community]
     |              (if daily done)
     v                     |
  +--------+               v
  |DRAWING |        +-----------+
  | (x3)   |        | COMMUNITY |
  +---+----+        +-----+-----+
      |                    |
      v                    |
  +--------+               |
  | REVIEW |               |
  +---+----+               |
      |                    |
      v                    |
  +---------+              |
  | WRITING |              |
  +---+-----+              |
      |                    |
      v                    |
  +----------+             |
  | COMPLETE |--[Community]--+
  +----+-----+
       |
       +--[History]--> HISTORY overlay
       +--[Share]--> Share options (inline, not a phase)
       +--[Restart]--> IDLE
```

### 6.3 Browser History / Back Button

Each forward navigation pushes a history entry:

| Action | Pushes History Entry |
|--------|---------------------|
| START_GAME | Yes |
| CONFIRM_TOKEN | Yes |
| START_WRITING | Yes |
| COMPLETE | Yes |
| VIEW_HISTORY | Yes |
| VIEW_COMMUNITY | Yes |

Back button behavior:
- Community overlay -> previous phase (COMPLETE or IDLE)
- History overlay -> previous phase
- COMPLETE -> WRITING
- WRITING -> REVIEW
- REVIEW -> DRAWING (green)
- DRAWING (green) -> DRAWING (blue)
- DRAWING (blue) -> DRAWING (red)
- DRAWING (red) -> IDLE

This matches the existing `initHistoryNavigation` pattern in `app.js`.

---

## 7. i18n Strategy

### 7.1 New String Keys

All new UI text must be added to the `STRINGS` table in `i18n.js`.

```javascript
// Daily Token
'daily.banner':           '오늘 모든 기록자가 같은 파편을 받습니다.',
'daily.banner.en':        'All archivists receive the same fragments today.',
'daily.dayLabel':         '{day}일차',
'daily.dayLabel.en':      'Day {day}',
'daily.subInstruction':   '오늘의 파편이 나타납니다',
'daily.subInstruction.en':'Today\'s fragment is revealed',
'daily.completed':        '오늘의 기록 완료!',
'daily.completed.en':     'Today\'s record complete!',
'daily.loadError':        '오늘의 파편을 불러올 수 없습니다. 자유 탐험 모드로 전환합니다.',
'daily.loadError.en':     'Could not load today\'s fragments. Switching to free exploration.',

// Community Feed
'community.title':        '오늘의 기록들',
'community.title.en':     'Today\'s Records',
'community.stats':        '{count}명의 기록자가 오늘의 세계를 기록했습니다.',
'community.stats.en':     '{count} archivists recorded today\'s world.',
'community.empty':        '아직 오늘의 기록이 없습니다.\n첫 번째 기록자가 되어 보세요!',
'community.empty.en':     'No records yet today.\nBe the first archivist!',
'community.loadMore':     '더 보기',
'community.loadMore.en':  'Load More',
'community.sortRecent':   '최신순',
'community.sortRecent.en':'Most Recent',
'community.sortLiked':    '공감순',
'community.sortLiked.en': 'Most Liked',
'community.viewBtn':      '다른 기록자들의 세계 보기',
'community.viewBtn.en':   'See community records',
'community.archivist':    '기록자 #{num}',
'community.archivist.en': 'Archivist #{num}',
'community.timeAgo':      '{time} 전',
'community.timeAgo.en':   '{time} ago',
'community.back':         '← 돌아가기',
'community.back.en':      '← Back',
'community.networkError':  '기록을 불러올 수 없습니다.\n잠시 후 다시 시도해 주세요.',
'community.networkError.en':'Could not load records.\nPlease try again later.',
'community.retry':        '다시 시도',
'community.retry.en':     'Retry',

// Like
'like.label':             '공감',
'like.label.en':          'Like',

// Share
'share.imageCard':        '이미지 카드',
'share.imageCard.en':     'Image Card',
'share.textCopy':         '텍스트 복사',
'share.textCopy.en':      'Copy Text',
'share.linkCopy':         '링크 복사',
'share.linkCopy.en':      'Copy Link',
'share.imageSaved':       '이미지가 저장되었습니다!',
'share.imageSaved.en':    'Image saved!',
'share.linkCopied':       '링크가 복사되었습니다.',
'share.linkCopied.en':    'Link copied.',
'share.formatSquare':     '정사각형',
'share.formatSquare.en':  'Square',
'share.formatStory':      '스토리',
'share.formatStory.en':   'Story',
'share.formatWide':       '와이드',
'share.formatWide.en':    'Wide',
'share.failed':           '공유에 실패했습니다. 복사를 시도해 주세요.',
'share.failed.en':        'Sharing failed. Try copying instead.',

// Free mode
'idle.freeExplore':       '자유 탐험',
'idle.freeExplore.en':    'Free Exploration',
'idle.todayRecords':      '오늘의 기록들',
'idle.todayRecords.en':   'Today\'s Records',

// Aria labels
'aria.community':         '오늘의 기록들 보기',
'aria.community.en':      'View today\'s records',
'aria.shareOptions':      '공유 옵션',
'aria.shareOptions.en':   'Share options',
'aria.like':              '공감하기',
'aria.like.en':           'Like this record',
'aria.toast':             '알림 메시지',
'aria.toast.en':          'Notification',
```

### 7.2 Date/Time Localization

Relative time strings ("2 hours ago") need locale-aware formatting:

```javascript
function relativeTime(isoString, locale) {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (locale === 'ko') {
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  }

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
```

### 7.3 Korean-Specific Considerations

- **Word break:** Korean text uses `word-break: keep-all` (already in CSS) to
  prevent mid-syllable breaks. Verify this on all new card components.
- **Font:** `Nanum Myeongjo` for story content in community cards.
- **Combo text order:** Korean is "green blue red" (no comma); English is
  "blue, green red" (with comma). Already handled by `formatCombo()`.
- **Share text length:** Korean characters are wider; ensure card text doesn't
  overflow. Use `measureText()` on canvas to dynamically adjust font size.

### 7.4 English-Specific Considerations

- **Narrative font swap:** English uses `Georgia` as primary narrative font
  (already handled by `[lang="en"] .narrative-font` rule in `screens.css`).
- **Card image:** When generating the canvas card, check `getLocale()` and
  apply the correct font family.

---

## 8. Edge Cases & Error States

### 8.1 Daily Token Edge Cases

| Edge Case | Handling |
|-----------|---------|
| User opens app at 11:59 PM, draws at 12:01 AM | Seed changes at midnight UTC. If mid-draw, complete with the old seed. New daily available on next session. |
| User completes daily, clears localStorage, returns | `dailyCompleted` flag is lost. Allow them to redo the daily (server tracks uniqueness for community feed). |
| Timezone differences | Use UTC day boundaries. Display local date in UI. |
| Daily token set changes mid-session | Finish current session with loaded tokens. Do not re-fetch mid-draw. |
| Offline mode | Use client-side seed (Option A). Community feed shows offline message. |

### 8.2 Community Feed Edge Cases

| Edge Case | Handling |
|-----------|---------|
| User's own record appears in feed | Highlight with a subtle border: "Your record" badge. |
| Offensive content | MVP: no moderation. Future: report button + server-side filtering. |
| Very long story text | Truncate to 150 characters in feed card, full text in detail view. |
| Feed loads slowly | Skeleton loading cards (3 placeholder cards with shimmer animation). |
| User has no network | Show offline message with cached daily tokens. |

### 8.3 Image Generation Edge Cases

| Edge Case | Handling |
|-----------|---------|
| Font not loaded | Use `document.fonts.ready` promise. Fallback to system fonts. |
| Story text too long for card | Dynamic line truncation. Show "..." after max lines (6 for square, 10 for story). |
| Emoji rendering differs across OS | Emoji render from system font. Accept platform differences. |
| Canvas creation fails (low memory) | Fallback to text-only share. Toast: "Image generation failed." |
| User has no story (edge: empty complete) | Card shows combo only, no story section. |

### 8.4 Share Edge Cases

| Edge Case | Handling |
|-----------|---------|
| Web Share API not available | Show download button for image, copy button for text. |
| Clipboard API not available | Fallback: create a temporary textarea, select, `document.execCommand('copy')`. |
| Share canceled by user | No error toast. Silent handling. |
| Share fails (permission denied) | Toast: "Sharing failed. Try copying instead." |
| Image blob too large for share | Reduce canvas quality (0.8 JPEG instead of PNG). |

---

## 9. Accessibility Considerations

### 9.1 New ARIA Requirements

| Component | ARIA | Notes |
|-----------|------|-------|
| Daily banner | `role="status"`, `aria-live="polite"` | Announces day number |
| Community feed overlay | `role="dialog"`, `aria-modal="true"` | Focus trap |
| Feed cards | `role="article"`, `aria-label="Archivist #23's record"` | Screen reader context |
| Like button | `aria-pressed="true/false"`, `aria-label="Like (12)"` | Toggle state |
| Share options panel | `aria-expanded="true/false"` on trigger button | Expandable section |
| Toast notification | `role="alert"`, `aria-live="assertive"` | Immediate announcement |
| Format selector | `role="radiogroup"`, each option `role="radio"` | Selection group |
| Load more button | `aria-label="Load 20 more records"` | Descriptive |

### 9.2 Keyboard Navigation

| Context | Tab Order |
|---------|-----------|
| Community feed | Back button -> Sort toggle -> Cards (sequential) -> Load more |
| Share options | Image Card -> Text Copy -> Link Copy -> Format selector |
| Feed card | Card body (expand) -> Like button -> Share button |

All interactive elements maintain the existing 44x44px minimum touch target
from `responsive.css`.

### 9.3 Screen Reader Announcements

| Event | Announcement (KO) | Announcement (EN) |
|-------|-------------------|-------------------|
| Daily banner shown | "47일차. 오늘 모든 기록자가 같은 파편을 받습니다." | "Day 47. All archivists receive the same fragments today." |
| Like toggled | "공감. 총 13개." | "Liked. 13 total." |
| Share completed | "클립보드에 복사되었습니다." | "Copied to clipboard." |
| Feed loaded | "47개의 기록을 불러왔습니다." | "Loaded 47 records." |
| Load more | "20개의 기록을 더 불러왔습니다." | "Loaded 20 more records." |

### 9.4 Reduced Motion

All new animations must respect `prefers-reduced-motion: reduce`:
- Toast: instant show/hide (no slide)
- Like animation: no scale bounce
- Skeleton shimmer: static placeholder
- Card expand: instant, no transition
- Share option panel: instant expand

---

## 10. Implementation Priority

### Phase 1: Daily Token (Foundation)

**Effort: Medium | Impact: High**

1. Implement client-side daily seed logic in `utils.js`
2. Add `dailyMode` / `dailySeed` to state
3. Hide redraw buttons when `dailyMode === true`
4. Add daily banner component to game layer
5. Update `IDLE` screen for daily-completed state
6. Add new i18n strings

**Dependencies:** None (purely client-side)

### Phase 2: Image Generation (Sharing prerequisite)

**Effort: Medium | Impact: High**

1. Create `cardRenderer.js` -- offscreen canvas card generation
2. Implement Square layout first (1080x1080)
3. Add Story (1080x1920) and Wide (1200x628) layouts
4. Font loading + fallback logic
5. Text truncation + dynamic sizing

**Dependencies:** None (purely client-side)

### Phase 3: Social Sharing (Builds on Phase 2)

**Effort: Low-Medium | Impact: High**

1. Create share options panel component
2. Implement Web Share API path (with file sharing)
3. Implement clipboard fallback
4. Implement image download fallback
5. Add Twitter intent URL builder
6. Add toast notification component
7. Add new i18n strings

**Dependencies:** Phase 2 (image generation)

### Phase 4: Community Feed (Requires backend)

**Effort: High | Impact: Medium-High**

1. Design and implement API endpoints (GET/POST /api/daily/records)
2. Create `layer-community` HTML structure
3. Implement feed card component
4. Implement like system (API + localStorage dedup)
5. Implement pagination ("Load More")
6. Implement sort toggle (recent/liked)
7. Implement skeleton loading states
8. Implement empty/error states
9. Add new i18n strings
10. Add browser history integration

**Dependencies:** Backend API, Phase 1 (daily tokens)

### Estimated CSS Impact

New files needed:
- `css/community.css` -- Community feed card styles, overlay
- `css/share.css` -- Share options panel, toast component

Existing file modifications:
- `css/screens.css` -- Daily banner, updated IDLE/COMPLETE layouts
- `css/main.css` -- Toast z-index layer variable

### Estimated JS Impact

New files needed:
- `js/daily.js` -- Daily seed logic, daily state management
- `js/cardRenderer.js` -- Canvas-based image generation
- `js/share.js` -- Share flow orchestration (Web Share, clipboard, download)
- `js/community.js` -- Feed API calls, like handling, pagination
- `js/toast.js` -- Toast notification system

Existing file modifications:
- `js/state.js` -- New phases (COMMUNITY), new state fields (daily*)
- `js/renderer.js` -- Daily banner rendering, community layer
- `js/app.js` -- New button bindings, share flow, community navigation
- `js/i18n.js` -- New string keys (both KO and EN)
- `js/tokens.js` -- `getDailyTokens(seed)` function

### Estimated HTML Impact

New sections in `index.html`:
- Daily banner element (inside `#layer-game`)
- Share options panel (inside `#step-complete`)
- Community feed layer (`#layer-community`)
- Toast container (fixed, at `#app` level)

---

## Appendix A: Complete Wireframe -- COMPLETE Step (Enhanced)

```
+--------------------------------------------------+
|  * --- * --- * --- *    (progress dots, all done) |
|                                                    |
|  +----------------------------------------------+ |
|  |  REVIEW SECTION (already visible, collapsed)  | |
|  |  [red chip] [blue chip] [green chip]          | |
|  |  "물에 녹는 투명한 시계"                        | |
|  +----------------------------------------------+ |
|                                                    |
|  +----------------------------------------------+ |
|  |  WRITING SECTION (already visible, collapsed) | |
|  |  (textarea, read-only at this point)          | |
|  +----------------------------------------------+ |
|                                                    |
|  +----------------------------------------------+ |
|  |  COMPLETE SECTION (active, scrolled into view)| |
|  |                                               | |
|  |  "세계가 기록되었습니다"                        | |
|  |                                               | |
|  |  +------------------------------------------+ | |
|  |  | "물에 녹는 투명한 시계"                    | | |
|  |  | "이 세계에서 시계는..."                    | | |
|  |  +------------------------------------------+ | |
|  |                                               | |
|  |  Rating: [ star ] [ star ] [ star ] [  ] [  ] | |
|  |                                               | |
|  |  +------------------------------------------+ | |
|  |  |  #47  Day Badge  (if daily mode)          | | |
|  |  +------------------------------------------+ | |
|  |                                               | |
|  |  [ Explore Again      ]  (btn--primary)       | |
|  |  [ Share Record       ]  (btn--secondary)     | |
|  |                                               | |
|  |  SHARE OPTIONS (hidden until Share tapped):   | |
|  |  +------------------------------------------+ | |
|  |  | [Img Card] [Text Copy] [Link Copy]       | | |
|  |  | Format: (Sq) (Story) (Wide)              | | |
|  |  +------------------------------------------+ | |
|  |                                               | |
|  |  [ See Community Records ] (btn--secondary)   | |
|  |  [ Archive             ]  (btn--ghost)        | |
|  |                                               | |
|  +----------------------------------------------+ |
|                                                    |
+--------------------------------------------------+
```

## Appendix B: Complete Wireframe -- Community Feed

```
+--------------------------------------------------+
|  <- 돌아가기              오늘의 기록들             |
|                                                    |
|  +----------------------------------------------+ |
|  |  47명의 기록자 | #47 | 2026-03-03             | |
|  +----------------------------------------------+ |
|                                                    |
|  Sort: [ 최신순 | 공감순 ]                          |
|                                                    |
|  +----------------------------------------------+ |
|  |  기록자 #23                          4시간 전  | |
|  |                                               | |
|  |  "이 세계에서 시계는 주인의 감정에 따라          | |
|  |   투명해지며, 비가 오면 서서히 녹아..."          | |
|  |                                               | |
|  |  [clock] [transparent] [dissolves]             | |
|  |  Rating: 4/5         [heart] 12               | |
|  +----------------------------------------------+ |
|                                                    |
|  +----------------------------------------------+ |
|  |  기록자 #41                          2시간 전  | |
|  |  (YOUR RECORD badge)                          | |
|  |                                               | |
|  |  "투명한 시계는 이 도시의 감시 도구다.           | |
|  |   비가 오면 모두의 시간이 리셋되어..."           | |
|  |                                               | |
|  |  [clock] [transparent] [dissolves]             | |
|  |  Rating: 5/5         [heart] 28               | |
|  +----------------------------------------------+ |
|                                                    |
|  +----------------------------------------------+ |
|  |  기록자 #12                          6시간 전  | |
|  |                                               | |
|  |  "시간은 물처럼 흐르고, 이 세계의 시계는         | |
|  |   그 흐름을 투명하게 보여준다..."                | |
|  |                                               | |
|  |  [clock] [transparent] [dissolves]             | |
|  |  Rating: 3/5         [heart] 5                | |
|  +----------------------------------------------+ |
|                                                    |
|              [ 더 보기 ]                            |
|                                                    |
+--------------------------------------------------+
```

## Appendix C: Shareable Card -- Final Mockup (ASCII)

### Square (1080x1080)

```
+--------------------------------------------------+
|                                                    |
|  :.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.:.   |
|  (parchment texture, subtle cross-hatch pattern)  |
|                                                    |
|                 N O V A   P O U C H                |
|                 (gold, letter-spaced)               |
|                                                    |
|     +--------+    +--------+    +--------+        |
|     |   clock |    | trans  |    | melts  |        |
|     |   emoji |    | emoji  |    | emoji  |        |
|     | "시계"  |    |"투명한" |    |"물에   |        |
|     |        |    |        |    | 녹는"  |        |
|     +--------+    +--------+    +--------+        |
|       (red bg)     (blue bg)    (green bg)        |
|                                                    |
|        "물에 녹는 투명한 시계"                       |
|        (Nanum Myeongjo, 22px)                      |
|                                                    |
|     -------------- * --------------                |
|                                                    |
|  "이 세계에서 시계는 주인의 감정에 따라              |
|   투명해지며, 비가 오면 서서히 녹아내려              |
|   시간의 의미를 잃는다. 사람들은 시간을              |
|   감정의 무게로 측정한다. 행복은 가볍고,             |
|   슬픔은 무겁다. 시계가 녹을 때마다..."              |
|  (Nanum Myeongjo, 18px, max 6 lines)              |
|                                                    |
|     -------------- * --------------                |
|                                                    |
|  Rating: 4/5 stars    |    Day 47                  |
|  2026-03-03           |    novapouch.app           |
|                                                    |
+--------------------------------------------------+
```

## Appendix D: Toast Component Specification

```
/* Position */
position: fixed;
bottom: calc(var(--safe-bottom) + 24px);
left: 50%;
transform: translateX(-50%);
z-index: var(--z-modal);
max-width: 400px;
width: calc(100% - 32px);

/* Appearance */
background: var(--card-bg);
border: 1px solid var(--card-border);
border-radius: var(--radius-md);
box-shadow: 0 4px 16px var(--card-shadow);
padding: 12px 20px;
font-size: 0.9rem;
color: var(--color-text);
text-align: center;

/* Animation */
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(16px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes toast-out {
  from { opacity: 1; transform: translateX(-50%) translateY(0); }
  to   { opacity: 0; transform: translateX(-50%) translateY(16px); }
}
```

---

*End of R02 UX Plan.*
