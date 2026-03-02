# R01 Implementation Tasks — Nova Pouch MVP

> 설계서: `.context/plans/R01-merged.md` 기반
> 기술: 바닐라 HTML/CSS/JS, ESM import, 프레임워크 없음

---

## Agent: Claude — 핵심 구조 + 데이터 + 상태 + 렌더링

Claude는 다음 파일들을 **직접 생성**해야 합니다:

### Task 1: index.html
- SPA 엔트리 포인트
- CSS 4개 파일 link
- JS `app.js`를 `type="module"`로 로드
- viewport 메타, 한국어 lang, Pretendard/나눔명조 웹폰트 로드
- 6개 화면을 위한 섹션 컨테이너 (`#screen-idle`, `#screen-drawing`, `#screen-review`, `#screen-writing`, `#screen-complete`, `#screen-history`)
- 각 화면에 설계서의 와이어프레임 구조대로 HTML 마크업

### Task 2: css/main.css
- CSS 변수 (컬러 팔레트: `--color-bg: #0F0C29`, `--color-red: #FF4B2B`, `--color-blue: #00D2FF`, `--color-green: #5DFFAB`, `--color-gold: #FFD700`, `--color-text: #E8E6E3`, `--color-text-secondary: #8B8B8B`)
- CSS 리셋 (box-sizing, margin, padding)
- body 스타일 (배경 그라데이션 #0F0C29 → #1A1B26, Pretendard 폰트)
- 공통 버튼, 카드, 컨테이너 스타일
- `.screen` 기본 스타일 (display:none, &.active display:flex)

### Task 3: css/pouch.css
- 주머니 컨테이너 레이아웃 (3개 주머니 가로 배치)
- 개별 주머니 스타일 (각 색상, 글래스모피즘 효과, 둥근 모서리)
- 주머니 idle 흔들림 애니메이션 (`@keyframes pouch-idle`)
- 주머니 격렬한 흔들림 (`@keyframes pouch-shake`)
- 주머니 hover/active 상태

### Task 4: css/token.css
- 토큰 카드 스타일 (글래스모피즘, glow 테두리)
- 토큰 떠오르기 애니메이션 (`@keyframes token-rise`)
- 토큰 뒤집기 애니메이션 (`@keyframes token-flip`)
- 토큰 슬롯 스타일 (뽑힌 토큰 표시 영역)
- 난이도 별표 스타일

### Task 5: css/screens.css
- 각 화면별 레이아웃
- `#screen-idle`: 중앙 정렬, 타이틀, 주머니 배치
- `#screen-drawing`: 중앙 큰 주머니, 진행 표시, 뽑은 토큰 슬롯
- `#screen-review`: 3개 토큰 카드 + 조합 텍스트 + 난이도
- `#screen-writing`: 토큰 요약 + 세계 이름 input + textarea
- `#screen-complete`: 결과 카드 + 별점 + 액션 버튼
- `#screen-history`: 카드 리스트 + 통계

### Task 6: js/tokens.js
- `TOKEN_REGISTRY` 객체: 설계서의 60개 토큰 전체 데이터 포함
- 각 주머니(red/blue/green)에 name, lore, color, tokens 배열
- `getTokensByPouch(pouchType)` 함수
- `getRandomToken(pouchType, excludeId)` — 가중치 랜덤 선택
- `formatCombo(tokens)` — "감정을 읽는, 물에 녹는 시계" 형식 생성
- `calculateDifficulty(tokens)` — 난이도 합산 + 등급 반환
- 모두 ESM export

### Task 7: js/state.js
- `GameState` 싱글턴 클래스 (옵저버 패턴)
- phase: 'IDLE' | 'DRAWING_RED' | 'DRAWING_BLUE' | 'DRAWING_GREEN' | 'REVIEW' | 'WRITING' | 'COMPLETE' | 'HISTORY'
- drawnTokens: { red, blue, green }
- redraws: { red: 0, blue: 0, green: 0 }
- lastDrawn: { red, blue, green }
- worldName, userStory, rating, isAnimating
- `subscribe(listener)`, `dispatch(action, payload)`, `getState()`
- `transition(action)` — 설계서의 상태 전환 로직 구현
- ESM export: `gameState` 인스턴스

### Task 8: js/renderer.js
- `initRenderer(gameState)` — 초기 바인딩
- `render(state)` — 현재 phase에 맞는 화면 표시
- 각 화면별 렌더 함수:
  - `renderIdle()` — 시작 화면
  - `renderDrawing(pouchType)` — 뽑기 화면 (어떤 주머니인지에 따라)
  - `renderReview()` — 조합 확인
  - `renderWriting()` — 기록 작성
  - `renderComplete()` — 완료
  - `renderHistory()` — 히스토리 리스트
- DOM 요소 캐싱
- ESM export

### Task 9: js/utils.js
- `weightedPick(items, weightFn, excludeId)` — 가중치 랜덤
- `shuffleArray(arr)` — Fisher-Yates
- `formatDate(isoString)` — 날짜 포맷
- `generateId()` — 세션 ID 생성
- `debounce(fn, ms)` — 디바운스
- `clamp(val, min, max)`
- ESM export

---

## Agent: Codex — 인터랙션 + localStorage + 앱 진입점 + 반응형

Codex는 다음 파일들을 **직접 생성**해야 합니다:

### Task 10: js/pouch.js
- `initPouch(gameState)` — 주머니 클릭 이벤트 바인딩
- 주머니 클릭 시 애니메이션 시퀀스 실행:
  1. isAnimating = true 설정
  2. shake 클래스 추가 (500ms)
  3. 토큰 선택 (tokens.js의 getRandomToken 호출)
  4. token-rise 애니메이션 (800ms)
  5. token-flip 애니메이션
  6. 토큰 내용 공개
  7. isAnimating = false
- 다시 뽑기 버튼 핸들러 (주머니당 1회)
- 확인 버튼 → state.dispatch('CONFIRM_TOKEN')
- `pointerdown`/`pointerup` 기반 터치 지원
- ESM export

### Task 11: js/history.js
- `STORAGE_KEY = 'nova-pouch-history'`
- `MAX_SESSIONS = 100`
- `loadHistory()` — localStorage에서 읽기 + 파싱 + 마이그레이션
- `saveSession(session)` — 세션 저장 (최신순 unshift, 100건 제한)
- `deleteAllHistory()` — 전체 삭제
- `getStats(history)` — 통계 계산 (totalPlayed, averageRating, favoriteTokens)
- `createEmptyHistory()` — 빈 히스토리 객체
- ESM export

### Task 12: js/app.js
- 메인 진입점 (DOMContentLoaded)
- `import` 모든 모듈
- gameState 초기화
- renderer 초기화 + state 구독
- pouch 인터랙션 초기화
- 버튼 이벤트 바인딩:
  - 시작 버튼 → dispatch('START_GAME')
  - 기록하기 버튼 → dispatch('START_WRITING')
  - 기록 완료 → dispatch('COMPLETE') + saveSession
  - 다시 탐험 → dispatch('RESTART')
  - 히스토리 보기 → dispatch('VIEW_HISTORY')
  - 별점 클릭 핸들러
  - 공유하기 (clipboard API)
- textarea 자동 높이 조절
- 최소 50자 유효성 검증
- ESM

### Task 13: 반응형 CSS 추가
- `css/screens.css`에 미디어쿼리 추가 (또는 기존 CSS 파일 수정)
- 모바일 (0~479px): 주머니 세로 스택, 풀 width
- 태블릿 (480~767px): 2열 혼합
- 데스크톱 (768px+): 데스크톱 확장
- 최소 터치 영역 44x44px
- safe-area-inset 대응
- `prefers-reduced-motion` 미디어쿼리로 애니메이션 건너뛰기

### Task 14: 접근성
- 모든 버튼/주머니에 `aria-label`
- 토큰 공개 시 `aria-live="polite"` 영역 업데이트
- 키보드 네비게이션 (Tab, Enter, Space)
- 포커스 스타일 (outline)
- 색약 대응: 주머니에 패턴/아이콘 구분자
