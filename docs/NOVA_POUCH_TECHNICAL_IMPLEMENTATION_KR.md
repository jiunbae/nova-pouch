# Nova Pouch 기술 구현 설계서

## 0. 기술 스택/원칙
- 런타임: 브라우저 네이티브(빌드 도구 없이 `HTML + CSS + ES Modules`)
- 아키텍처: UI 계층 / 도메인 계층 / 데이터 계층 분리
- 목표: 저사양 모바일에서도 60fps에 가깝게 동작, 오프라인 재방문 가능(LocalStorage)
- 접근성: 키보드/스크린리더 대응(`aria-live`, `button` 시맨틱)

---

## 1. Code Architecture

### 1.1 파일 구조 (Vanilla)
```text
nova-pouch/
  index.html
  /assets
    /img
      pouch-red.svg
      pouch-blue.svg
      pouch-green.svg
      token-back.svg
    /audio
      draw.mp3
      reveal.mp3
  /styles
    reset.css
    tokens.css
    animations.css
    app.css
  /js
    main.js
    /core
      game-state.js
      state-machine.js
      event-bus.js
      rng.js
    /domain
      token-repository.js
      draw-service.js
      prompt-builder.js
      score-service.js
    /ui
      dom-refs.js
      pouch-view.js
      token-view.js
      history-view.js
      toast-view.js
      input-view.js
    /storage
      local-storage.js
      serializer.js
    /config
      constants.js
      feature-flags.js
  /data
    tokens.json
  /docs
    NOVA_POUCH_TECHNICAL_IMPLEMENTATION_KR.md
```

### 1.2 모듈 설계 원칙
- `core`: 프레임워크 독립 로직(상태머신, 난수, 이벤트 디스패치)
- `domain`: 게임 규칙(토큰 추첨, 조합 유효성, 라운드 결과 생성)
- `ui`: DOM 렌더링/애니메이션만 담당(도메인 직접 수정 금지)
- `storage`: 직렬화, 버전 마이그레이션
- `config`: 밸런스/기능 플래그를 코드에서 분리

### 1.3 엔트리포인트 흐름
1. `main.js`가 `tokens.json` 로드
2. `GameState` 초기화(LocalStorage 복원)
3. UI 컴포넌트 바인딩 및 이벤트 등록
4. 첫 화면 렌더링(대기 상태)
5. 사용자 입력(`Draw`) 시 상태머신 전이

---

## 2. Animation & Interaction

### 2.1 파우치 추첨 애니메이션
- 추천 방식: `CSS Transform + Web Animations API`
- 이유:
  - DOM 기반 UI와 결합이 쉬움
  - `transform`, `opacity` 중심으로 GPU 가속 가능
  - 유지보수 비용이 Canvas/게임엔진 대비 낮음

### 2.2 애니메이션 시퀀스
1. 파우치 탭/클릭
2. 파우치 흔들림(`shake`, 300ms)
3. 토큰 카드가 파우치에서 상승(`translateY + scale`, 450ms)
4. 카드 뒤집기(`rotateY`, 220ms)
5. 토큰 텍스트/아이콘 등장(`fade-up`, 180ms)

### 2.3 CSS vs Canvas vs Library 선택
- CSS/WAAPI(채택): UI 중심 인터랙션에 최적, 번들 0
- Canvas(부분 사용 가능): 파티클/글로우 같은 장식 효과만 선택적으로 사용
- 외부 라이브러리(비채택 기본): 초기 버전에서는 불필요. 고급 효과가 필요할 때 `GSAP`만 제한 도입

### 2.4 인터랙션 세부
- 클릭, 탭, 키보드(`Space/Enter`) 지원
- 다중 입력 방지: 애니메이션 중 버튼 잠금(`isInputLocked`)
- 실수 탭 방지: 터치 종료(`pointerup`) 기준으로 추첨 확정

---

## 3. Code Structure

### 3.1 핵심 클래스/모듈 의사코드
```js
// core/game-state.js
export class GameState {
  constructor(initial) {
    this.phase = initial.phase; // IDLE | DRAWING | REVEALED | WRITING | SAVED
    this.round = initial.round;
    this.currentDraw = initial.currentDraw; // { red, blue, green }
    this.history = initial.history;
  }
}
```

```js
// core/state-machine.js
const transitions = {
  IDLE: ['DRAW_REQUEST'],
  DRAWING: ['DRAW_COMPLETE'],
  REVEALED: ['START_WRITING', 'REDRAW'],
  WRITING: ['SAVE_WORLD', 'CANCEL_WRITING'],
  SAVED: ['NEXT_ROUND']
};

export function dispatch(state, event) {
  if (!transitions[state.phase].includes(event.type)) return state;
  return reduce(state, event);
}
```

```js
// domain/draw-service.js
export class DrawService {
  constructor(tokenRepo, rng) {
    this.tokenRepo = tokenRepo;
    this.rng = rng;
  }

  drawTriple(excludedTokenIds = new Set()) {
    return {
      red: this.tokenRepo.pickOne('object', excludedTokenIds, this.rng),
      blue: this.tokenRepo.pickOne('attribute', excludedTokenIds, this.rng),
      green: this.tokenRepo.pickOne('constraint', excludedTokenIds, this.rng)
    };
  }
}
```

```js
// ui/pouch-view.js
export function bindPouchInteractions({ onDrawRequest }) {
  const btn = document.querySelector('[data-action="draw"]');
  btn.addEventListener('pointerup', () => onDrawRequest());
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') onDrawRequest();
  });
}
```

### 3.2 이벤트 처리 전략
- 단일 진입점: 모든 사용자 액션을 `dispatch({type, payload})`로 통일
- UI 이벤트 -> 커맨드 이벤트 -> 상태머신 -> 렌더
- 렌더러는 현재 상태를 읽어 idempotent하게 다시 그림

### 3.3 상태 머신 정의
- `IDLE`: 대기
- `DRAWING`: 애니메이션/추첨 수행 중
- `REVEALED`: 3개 토큰 공개 완료
- `WRITING`: 사용자 세계관 텍스트 입력
- `SAVED`: 저장 완료, 다음 라운드 가능

상태 전이 규칙 예:
- `IDLE -> DRAWING`: `DRAW_REQUEST`
- `DRAWING -> REVEALED`: `DRAW_COMPLETE`
- `REVEALED -> WRITING`: `START_WRITING`
- `WRITING -> SAVED`: `SAVE_WORLD`
- `SAVED -> IDLE`: `NEXT_ROUND`

---

## 4. Data Layer

### 4.1 토큰 JSON 포맷
```json
{
  "version": 1,
  "categories": {
    "object": [
      { "id": "obj_umbrella", "label_ko": "우산", "rarity": 1 },
      { "id": "obj_shoes", "label_ko": "신발", "rarity": 1 },
      { "id": "obj_clock", "label_ko": "시계", "rarity": 1 },
      { "id": "obj_glasses", "label_ko": "안경", "rarity": 1 },
      { "id": "obj_chair", "label_ko": "의자", "rarity": 1 },
      { "id": "obj_cup", "label_ko": "컵", "rarity": 1 },
      { "id": "obj_key", "label_ko": "열쇠", "rarity": 1 },
      { "id": "obj_pillow", "label_ko": "베개", "rarity": 1 }
    ],
    "attribute": [
      { "id": "att_transparent", "label_ko": "투명한", "rarity": 1 },
      { "id": "att_flying", "label_ko": "날아다니는", "rarity": 1 },
      { "id": "att_singing", "label_ko": "노래하는", "rarity": 1 },
      { "id": "att_time_reversing", "label_ko": "시간을 되감는", "rarity": 1 },
      { "id": "att_emotion_reading", "label_ko": "감정을 읽는", "rarity": 1 }
    ],
    "constraint": [
      { "id": "con_mesh_holes", "label_ko": "그물 같은 구멍이 있음", "rarity": 1 },
      { "id": "con_water_dissolve", "label_ko": "물에 닿으면 녹음", "rarity": 1 },
      { "id": "con_night_only", "label_ko": "밤에만 작동", "rarity": 1 },
      { "id": "con_single_use", "label_ko": "1회용", "rarity": 1 }
    ]
  }
}
```

### 4.2 랜덤 선택 알고리즘
- 기본: 카테고리별 균등 무작위 1개씩 추첨
- 반복 감소 전략:
  - 최근 N라운드(예: 3)에서 나온 `id`는 우선 제외
  - 제외 후 후보가 비면 제외 집합을 해제하고 재추첨
- 구현:
  - `crypto.getRandomValues` 기반 RNG 우선
  - 미지원 환경에서 `Math.random` 폴백

의사코드:
```js
function pickOne(pool, excluded, rng) {
  let candidates = pool.filter(t => !excluded.has(t.id));
  if (candidates.length === 0) candidates = pool;
  const idx = rng.int(0, candidates.length - 1);
  return candidates[idx];
}
```

### 4.3 LocalStorage 스키마
- 키: `nova-pouch:v1:save`
- 값(JSON):
```json
{
  "version": 1,
  "updatedAt": "2026-03-02T12:00:00.000Z",
  "settings": {
    "sfx": true,
    "reducedMotion": false,
    "locale": "ko-KR"
  },
  "progress": {
    "round": 7,
    "lastDraw": {
      "objectId": "obj_clock",
      "attributeId": "att_singing",
      "constraintId": "con_water_dissolve"
    }
  },
  "history": [
    {
      "id": "entry_001",
      "createdAt": "2026-03-02T11:58:12.120Z",
      "draw": ["obj_clock", "att_singing", "con_water_dissolve"],
      "worldText": "도시의 시계는 노래로 시간을 알려주고 비가 오면 사라진다."
    }
  ]
}
```

### 4.4 마이그레이션 정책
- `version` 불일치 시 `migrator` 실행
- 실패 시 안전 폴백: 설정만 유지하고 `history`는 백업 후 초기화

---

## 5. Mobile-First

### 5.1 레이아웃/뷰포트
- `meta viewport`: `width=device-width, initial-scale=1, viewport-fit=cover`
- 기준 브레이크포인트:
  - 기본: `320px~767px` (단일 컬럼)
  - 태블릿 이상: `>=768px` (파우치/기록 영역 2컬럼)
- 터치 영역 최소 `44x44px`

### 5.2 터치 제스처
- 핵심 제스처: `tap`만 필수
- 옵션 제스처:
  - 좌우 스와이프: 히스토리 카드 넘기기
  - 길게 누르기: 토큰 설명 툴팁
- 구현은 `Pointer Events` 단일화(마우스/터치 공통)

### 5.3 성능 전략
- 애니메이션은 `transform/opacity`만 사용
- `will-change`는 애니메이션 직전에만 적용 후 해제
- 강제 리플로우 유발 코드(`offsetWidth` 연속 접근) 금지
- 이미지는 SVG 우선, 오디오는 짧은 효과음 2~3개로 제한
- 초기 로딩 최적화:
  - 토큰 JSON 지연 로딩 대신 최초 1회 prefetch
  - 기록(history) 렌더는 최근 10개만 우선 표시

### 5.4 접근성/모바일 UX
- `prefers-reduced-motion` 감지 시 애니메이션 시간 70% 단축 또는 비활성화
- 토큰 공개 텍스트는 `aria-live="polite"`로 읽기 지원
- 진동 피드백(`navigator.vibrate(20)`)은 지원 환경에서 선택적 사용

---

## 6. 구현 우선순위 (MVP -> 확장)
1. MVP
- 3색 파우치 추첨, 토큰 공개, 텍스트 입력/저장, 히스토리 표시
2. V1.1
- 최근 중복 회피 추첨, SFX/모션 설정, 키보드 접근성 강화
3. V1.2
- 테마 스킨, 공유 링크(압축된 draw+text), 통계(가장 많이 나온 토큰)

## 7. 테스트 체크리스트
- 상태 전이 테스트: 허용되지 않은 이벤트 무시 여부
- 랜덤 추첨 테스트: 카테고리 누락 없이 1개씩 추첨되는지
- 저장/복원 테스트: 새로고침 후 라운드/기록 유지 여부
- 모바일 테스트: iOS Safari, Android Chrome에서 터치/성능 확인
- 접근성 테스트: 키보드만으로 전체 플로우 가능 여부
