# Nova Pouch 웹 게임 기술 구현 계획 (R01-codex)

## 0) 목표와 원칙
- **게임 목표**: 3개 파우치(빨강/파랑/초록)에서 토큰을 뽑아 조합하고, 플레이어가 상상 세계를 텍스트로 창작하는 싱글플레이 웹 게임.
- **기술 원칙**: 바닐라 HTML/CSS/JS, 모바일 우선, 저사양 기기 대응, 확장 가능한 모듈 설계.
- **MVP 범위**: 토큰 드로우/애니메이션/조합 표시/설명 입력/세션 저장(LocalStorage).

---

## 1) Code Architecture

### 1.1 파일 구조 (Vanilla)
```txt
nova-pouch/
  index.html
  /assets
    /icons
      pouch-red.svg
      pouch-blue.svg
      pouch-green.svg
      token.svg
    /audio
      draw.mp3
      reveal.mp3
  /styles
    reset.css
    tokens.css
    layout.css
    animations.css
  /js
    main.js
    /core
      config.js
      constants.js
      event-bus.js
      state-machine.js
    /data
      token-repo.js
      rng.js
      storage.js
    /domain
      game-session.js
      pouch.js
      token.js
    /ui
      app-view.js
      pouch-view.js
      token-view.js
      compose-view.js
      toast.js
    /controllers
      game-controller.js
      input-controller.js
  /data
    tokens.red.json
    tokens.blue.json
    tokens.green.json
```

### 1.2 모듈 설계
- `core/`:
  - 앱 전역 설정, 상수, 상태머신, 느슨한 결합용 이벤트 버스.
- `data/`:
  - JSON 로딩, 랜덤 선택 알고리즘, LocalStorage 영속화.
- `domain/`:
  - 게임 규칙(파우치, 토큰, 세션 상태) 중심의 순수 로직.
- `ui/`:
  - DOM 렌더링, 애니메이션 클래스 토글, 접근성(ARIA) 반영.
- `controllers/`:
  - 사용자 입력을 도메인 로직과 UI에 연결.

### 1.3 의존 방향
- `ui -> controllers -> domain <- data`
- `core`는 전 계층 공통 사용.
- UI가 데이터 저장소를 직접 호출하지 않고 `GameController`를 통해서만 변경.

---

## 2) Animation

### 2.1 선택 전략 (권장)
- **기본: CSS 애니메이션 + JS 제어**
  - 장점: 구현 단순, 번들 0, 모바일 성능 양호.
  - 적용: 파우치 흔들림, 토큰 플립, 페이드/슬라이드 리빌.
- **보조: Canvas 미사용 (MVP)**
  - Canvas는 파티클이 핵심일 때 도입. 현재는 DOM/CSS로 충분.
- **외부 라이브러리: 미도입**
  - GSAP/Lottie는 후속 단계(브랜딩/연출 강화)에서 선택.

### 2.2 애니메이션 플로우
1. 파우치 탭/클릭
2. `draw-start` 상태 진입
3. 파우치 요소 `shake` 클래스 300~450ms
4. 토큰 카드 생성 후 `reveal-enter` (scale + rotateX)
5. 토큰 텍스트 지연 표시(예: 120ms)
6. 완료 시 `draw-complete` 이벤트 발행

### 2.3 성능 가이드
- `transform`, `opacity`만 애니메이션.
- `will-change`는 드로우 직전만 부여 후 제거.
- 연속 애니메이션은 `requestAnimationFrame` 스케줄링.
- 저사양/접근성: `prefers-reduced-motion`에서 즉시 리빌.

---

## 3) Code Structure

### 3.1 클래스 설계 (의사코드)
```js
// domain/token.js
class Token {
  constructor({ id, pouch, label, tags = [], rarity = "common", weight = 1 }) {
    this.id = id;
    this.pouch = pouch;      // red | blue | green
    this.label = label;
    this.tags = tags;
    this.rarity = rarity;
    this.weight = weight;
  }
}

// domain/pouch.js
class Pouch {
  constructor(type, tokens) {
    this.type = type;
    this.tokens = tokens;
    this.drawnIds = new Set();
  }

  draw(rng, { noRepeatInRound = true } = {}) {
    const candidates = noRepeatInRound
      ? this.tokens.filter(t => !this.drawnIds.has(t.id))
      : this.tokens;

    const picked = rng.weightedPick(candidates);
    if (picked) this.drawnIds.add(picked.id);
    return picked;
  }

  resetRound() {
    this.drawnIds.clear();
  }
}

// domain/game-session.js
class GameSession {
  constructor({ redPouch, bluePouch, greenPouch }) {
    this.pouches = { red: redPouch, blue: bluePouch, green: greenPouch };
    this.phase = "idle";
    this.currentCombo = { red: null, blue: null, green: null };
    this.storyText = "";
    this.history = [];
  }

  drawFrom(pouchType, rng) {
    if (!["idle", "ready"].includes(this.phase)) return null;
    this.phase = "drawing";
    const token = this.pouches[pouchType].draw(rng);
    this.currentCombo[pouchType] = token;
    this.phase = this.isComboComplete() ? "combo_ready" : "ready";
    return token;
  }

  isComboComplete() {
    return this.currentCombo.red && this.currentCombo.blue && this.currentCombo.green;
  }

  finalizeStory(text) {
    if (!this.isComboComplete()) return false;
    this.storyText = text.trim();
    this.history.push({ combo: { ...this.currentCombo }, storyText: this.storyText, ts: Date.now() });
    this.phase = "submitted";
    return true;
  }

  nextRound() {
    this.currentCombo = { red: null, blue: null, green: null };
    this.storyText = "";
    this.phase = "idle";
  }
}
```

### 3.2 상태 머신
```txt
idle
  -> (draw pouch) drawing

drawing
  -> (animation done, token stored) ready
  -> (if 3 tokens completed) combo_ready

combo_ready
  -> (submit story) submitted
  -> (redraw specific pouch) drawing

submitted
  -> (next round) idle

error
  -> (recover) idle
```

### 3.3 이벤트 처리 규칙
- 입력 이벤트
  - `click` + `pointerup` 기반, 모바일/데스크톱 통합.
- 커스텀 이벤트 예시
  - `DRAW_REQUESTED { pouchType }`
  - `DRAW_ANIMATION_DONE { pouchType, tokenId }`
  - `COMBO_COMPLETED { combo }`
  - `STORY_SUBMITTED { text }`
- 원칙
  - UI 이벤트 -> Controller -> Domain 갱신 -> UI 렌더 -> Storage 저장.
  - 동일 프레임 중복 탭 방지를 위한 `isInputLocked` 플래그 사용.

---

## 4) Data Layer

### 4.1 토큰 JSON 포맷
```json
{
  "version": 1,
  "pouch": "red",
  "tokens": [
    {
      "id": "obj_umbrella",
      "label": "우산",
      "rarity": "common",
      "weight": 8,
      "tags": ["object", "portable"]
    },
    {
      "id": "obj_clock",
      "label": "시계",
      "rarity": "uncommon",
      "weight": 5,
      "tags": ["object", "time"]
    }
  ]
}
```

### 4.2 랜덤 선택 정책
- 기본: **가중치 랜덤(weighted random)**.
- 라운드 내 중복 방지: 같은 파우치에서 동일 토큰 재출현 방지 옵션.
- 재현성(테스트): seed 기반 RNG 지원.

의사코드:
```js
function weightedPick(tokens, rand01) {
  const sum = tokens.reduce((a, t) => a + (t.weight || 1), 0);
  let r = rand01() * sum;
  for (const t of tokens) {
    r -= (t.weight || 1);
    if (r <= 0) return t;
  }
  return tokens[tokens.length - 1] ?? null;
}
```

### 4.3 LocalStorage 스키마
- 키: `novaPouch.v1.session`
```json
{
  "version": 1,
  "lastPlayedAt": 1730000000000,
  "settings": {
    "reducedMotion": false,
    "sfx": true,
    "language": "ko"
  },
  "session": {
    "phase": "ready",
    "currentCombo": {
      "red": "obj_umbrella",
      "blue": "attr_flying",
      "green": "cons_night_only"
    },
    "storyDraft": "밤에만 열리는 우산 도시..."
  },
  "history": [
    {
      "id": "round_001",
      "ts": 1730000000000,
      "combo": {
        "red": "obj_clock",
        "blue": "attr_singing",
        "green": "cons_mesh_holes"
      },
      "storyText": "노래하는 시계탑 세계"
    }
  ]
}
```

### 4.4 저장 전략
- 디바운스 저장: 입력 중 500ms 간격.
- 핵심 시점 즉시 저장: 토큰 확정, 스토리 제출, 다음 라운드.
- 마이그레이션: `version` 불일치 시 `migrate(vOld -> vNew)` 수행.

---

## 5) Mobile-First

### 5.1 터치 UX
- 파우치 인터랙션: `pointerdown` 시 눌림 피드백, `pointerup`에서 드로우 확정.
- 스와이프 제스처(선택): 히스토리 카드 좌우 전환.
- 햅틱(지원 브라우저): 토큰 리빌 시 짧은 진동 (`navigator.vibrate(10)`).

### 5.2 뷰포트/레이아웃
- 필수 메타:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```
- Safe area 대응: `padding: env(safe-area-inset-*)`.
- 기준 브레이크포인트:
  - `0~479px`: 1열, 파우치 세로 스택
  - `480~767px`: 2열 혼합
  - `768px+`: 데스크톱 확장 레이아웃

### 5.3 모바일 성능 최적화
- 초기 JS < 80KB(압축 기준) 목표.
- 이미지: SVG 우선, 필요 시 WebP fallback.
- 폰트: 시스템 폰트 우선 + preload 최소화.
- 이벤트 리스너 passive 적용(`touchstart`, `wheel`).
- 긴 목록(히스토리) 가상화 또는 페이지네이션.

### 5.4 접근성
- 버튼 크기 최소 44x44px.
- 대비 4.5:1 이상.
- `aria-live="polite"`로 토큰 리빌 텍스트 읽기.
- 모션 감소 설정 사용 시 애니메이션 단축/제거.

---

## 6) 구현 순서 제안 (MVP 기준)
1. 데이터 스키마/JSON 토큰 로더 구현
2. 도메인(`Token`, `Pouch`, `GameSession`) 및 상태머신 구현
3. 기본 UI 렌더 + 드로우 플로우 연결
4. CSS 애니메이션 및 reduced-motion 대응
5. 스토리 입력/제출/히스토리 및 LocalStorage 저장
6. 모바일 터치/성능/접근성 최적화
7. 테스트(랜덤 로직, 상태 전이, 저장 복원)

## 7) 테스트 포인트
- 상태 전이: `idle -> drawing -> ready/combo_ready -> submitted -> idle`
- 랜덤: 가중치 반영 분포, 중복 방지 옵션 동작
- 저장/복원: 새로고침 후 진행 상태 재현
- 모바일: iOS Safari, Android Chrome에서 터치/레이아웃/성능 확인
