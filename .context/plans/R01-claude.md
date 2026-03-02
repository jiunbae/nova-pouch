# Nova Pouch - 웹 게임 설계 문서

> 현실에 존재하지 않는 물건을 만들고, 그 물건이 자연스럽게 사용될 세계를 상상하는 싱글플레이어 창의력 게임

---

## 1. 전체 게임 아키텍처

### 1.1 파일 구조

```
nova-pouch/
├── index.html                  # 메인 엔트리 (SPA)
├── css/
│   ├── main.css                # 전역 스타일, CSS 변수, 리셋
│   ├── pouch.css               # 주머니 관련 스타일 (애니메이션 포함)
│   ├── token.css               # 토큰 카드 스타일
│   └── screens.css             # 각 화면(단계)별 레이아웃
├── js/
│   ├── app.js                  # 앱 초기화, 라우팅, 전역 이벤트
│   ├── state.js                # 상태 관리 (GameState 싱글턴)
│   ├── tokens.js               # 토큰 데이터 및 뽑기 로직
│   ├── renderer.js             # DOM 렌더링 (화면 전환, UI 업데이트)
│   ├── pouch.js                # 주머니 인터랙션 (클릭, 흔들기, 애니메이션)
│   ├── history.js              # 히스토리 관리 (localStorage CRUD)
│   └── utils.js                # 유틸리티 (랜덤, 셔플, 날짜 포맷 등)
├── assets/
│   ├── sounds/                 # 효과음 (뽑기, 전환 등) - 선택사항
│   └── images/                 # 주머니 이미지, 배경 등 - 선택사항
└── .context/
    └── plans/
        └── R01-claude.md       # 이 설계 문서
```

### 1.2 데이터 모델 설계

#### 토큰(Token) 스키마

```json
{
  "id": "red-001",
  "category": "red",
  "label": "우산",
  "emoji": "☂️",
  "difficulty": 1,
  "tags": ["일상", "도구"]
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | `string` | 카테고리 접두사 + 3자리 번호 (예: `red-001`, `blue-003`) |
| `category` | `"red" \| "blue" \| "green"` | 소속 주머니 |
| `label` | `string` | 토큰에 표시되는 텍스트 |
| `emoji` | `string` | 시각적 보조 이모지 |
| `difficulty` | `1 \| 2 \| 3` | 난이도 가중치 (1=쉬움, 3=어려움) |
| `tags` | `string[]` | 분류 태그 (확장용, 필터링/통계에 활용) |

#### 게임 세션(Session) 스키마

```json
{
  "id": "session-1709312400000",
  "createdAt": "2026-03-02T12:00:00.000Z",
  "tokens": {
    "red": { "id": "red-003", "label": "시계", "emoji": "⏰" },
    "blue": { "id": "blue-007", "label": "감정을 읽는", "emoji": "💭" },
    "green": { "id": "green-002", "label": "물에 녹는", "emoji": "💧" }
  },
  "combinedDifficulty": 5,
  "userStory": "이 세계에서는...",
  "worldName": "감정의 시간이 녹는 세계",
  "rating": 4,
  "completedAt": "2026-03-02T12:15:00.000Z"
}
```

#### 히스토리(History) 스키마 (localStorage)

```json
{
  "version": 1,
  "sessions": [ /* Session 배열 */ ],
  "stats": {
    "totalPlayed": 12,
    "averageRating": 3.8,
    "favoriteTokens": { "red-003": 3, "blue-007": 2 }
  }
}
```

### 1.3 상태 관리 방식

프레임워크 없이 **옵저버 패턴 기반의 경량 상태 머신**을 구현한다.

```
GameState (싱글턴)
├── phase: Phase           // 현재 게임 단계
├── drawnTokens: Map       // 뽑힌 토큰들
├── userStory: string      // 사용자 작성 내용
├── listeners: Set         // 상태 변경 구독자들
├── subscribe(fn)          // 구독
├── dispatch(action)       // 상태 변경 디스패치
└── getState()             // 현재 상태 스냅샷
```

**Phase(단계) 열거형:**

```
IDLE -> DRAWING_RED -> DRAWING_BLUE -> DRAWING_GREEN -> REVIEW -> WRITING -> COMPLETE
```

### 1.4 모듈 간 관계도

```
┌─────────────┐
│   app.js    │  초기화, 이벤트 바인딩
│  (진입점)    │
└──────┬──────┘
       │ 초기화
       ▼
┌─────────────┐     구독/알림     ┌──────────────┐
│  state.js   │◄────────────────►│ renderer.js  │
│ (상태 관리)  │                  │  (화면 렌더)  │
└──────┬──────┘                  └──────┬───────┘
       │ 상태 조회                       │ DOM 조작
       ▼                               ▼
┌─────────────┐                 ┌──────────────┐
│ tokens.js   │                 │  pouch.js    │
│ (토큰 데이터) │                 │ (인터랙션)    │
└─────────────┘                 └──────────────┘
       │                               │
       └───────────┬───────────────────┘
                   ▼
            ┌─────────────┐
            │ history.js  │
            │ (저장/불러오기) │
            └─────────────┘
```

**흐름 요약:**
1. `app.js`가 `state.js`를 초기화하고 `renderer.js`를 상태 구독자로 등록
2. 사용자 인터랙션은 `pouch.js`에서 캡처하여 `state.dispatch(action)`을 호출
3. `state.js`가 상태를 업데이트하고 모든 구독자에게 알림
4. `renderer.js`가 새 상태에 따라 DOM을 업데이트
5. 게임 완료 시 `history.js`가 localStorage에 세션을 저장

---

## 2. UX 플로우

### 2.1 전체 사용자 여정

```
[시작 화면] → [뽑기 화면: 빨강] → [뽑기 화면: 파랑] → [뽑기 화면: 초록]
     ↓                                                        ↓
[히스토리]                                              [조합 확인 화면]
                                                              ↓
                                                       [세계관 작성 화면]
                                                              ↓
                                                        [완료/공유 화면]
                                                              ↓
                                                    [다시 하기 → 시작 화면]
```

### 2.2 각 단계별 화면 구성

#### 화면 1: 시작 화면 (IDLE)

```
┌──────────────────────────────────────────┐
│                                          │
│            ✦ NOVA POUCH ✦               │
│                                          │
│     현실에 없는 물건을 만들고             │
│     그 물건이 쓰이는 세계를 상상하세요     │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │  🔴      │  │  🔵      │  │  🟢      ││
│  │  물건    │  │  속성    │  │  제약    ││
│  │  주머니  │  │  주머니  │  │  주머니  ││
│  └──────────┘  └──────────┘  └──────────┘│
│                                          │
│         [ 주머니를 열어보세요 ]           │
│                                          │
│                          [ 📜 히스토리 ] │
└──────────────────────────────────────────┘
```

- 세 주머니가 나란히 놓여 있고, 미세하게 흔들리는 idle 애니메이션 적용
- "주머니를 열어보세요" 버튼으로 게임 시작
- 히스토리 버튼으로 과거 기록 열람

#### 화면 2: 뽑기 화면 (DRAWING_RED / DRAWING_BLUE / DRAWING_GREEN)

```
┌──────────────────────────────────────────┐
│  단계: ● ○ ○     물건 주머니를 열어보세요  │
│                                          │
│                                          │
│              ┌──────────┐                │
│              │          │                │
│              │   🔴     │  ← 클릭/탭    │
│              │  물건    │     가능       │
│              │  주머니  │                │
│              │          │                │
│              └──────────┘                │
│                                          │
│         탭하여 토큰을 뽑으세요            │
│                                          │
│  ┌─ 이미 뽑은 토큰 ─────────────────┐   │
│  │  (아직 없음)                       │   │
│  └───────────────────────────────────┘   │
│                                          │
│                             [ 다시 뽑기 ] │
└──────────────────────────────────────────┘
```

**인터랙션 시퀀스:**
1. 주머니가 화면 중앙에 크게 표시됨
2. 사용자가 주머니를 탭/클릭
3. 주머니가 흔들리는 애니메이션 (0.5초)
4. 주머니 입구가 열리며 토큰이 위로 튀어나오는 애니메이션 (0.8초)
5. 토큰이 카드 형태로 화면 중앙에 펼쳐짐 (flip 애니메이션)
6. 토큰 내용이 공개됨
7. 하단에 뽑은 토큰이 슬롯에 배치됨
8. 1.5초 후 또는 "다음" 탭 시 다음 주머니로 전환

**다시 뽑기:** 각 주머니 단계에서 1회 다시 뽑기 가능 (무제한이면 긴장감 상실)

#### 화면 3: 조합 확인 화면 (REVIEW)

```
┌──────────────────────────────────────────┐
│                                          │
│          당신의 물건이 만들어졌습니다!     │
│                                          │
│  ┌──────┐    ┌──────┐    ┌──────┐       │
│  │ ⏰   │  + │ 💭   │  + │ 💧   │       │
│  │ 시계 │    │감정을 │    │물에  │       │
│  │      │    │읽는   │    │녹는  │       │
│  └──────┘    └──────┘    └──────┘       │
│                                          │
│       ══════════════════════             │
│       "감정을 읽는, 물에 녹는 시계"       │
│       ══════════════════════             │
│                                          │
│  난이도: ★★★☆☆                          │
│                                          │
│  이 물건이 자연스럽게 사용되는             │
│  세계는 어떤 모습일까요?                  │
│                                          │
│  [ 세계를 상상하기 ]     [ 다시 조합하기 ] │
└──────────────────────────────────────────┘
```

- 세 토큰이 합쳐지는 애니메이션 (좌/중/우에서 중앙으로 모이기)
- 조합된 물건 이름이 자연어로 합성되어 표시
- 난이도 표시 (3개 토큰 difficulty 합산)
- "다시 조합하기"로 처음부터 다시 뽑기 가능

#### 화면 4: 세계관 작성 화면 (WRITING)

```
┌──────────────────────────────────────────┐
│  ← 뒤로                                 │
│                                          │
│  당신의 물건: "감정을 읽는, 물에 녹는 시계" │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  세계의 이름                      │    │
│  │  [                             ] │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  이 물건이 쓰이는 세계를 설명하세요 │    │
│  │                                  │    │
│  │  - 이 세계는 어떤 곳인가요?       │    │
│  │  - 누가 이 물건을 사용하나요?     │    │
│  │  - 왜 이 물건이 필요한가요?       │    │
│  │  - 이 물건의 제약은 어떤 영향을   │    │
│  │    미치나요?                      │    │
│  │                                  │    │
│  │  [                             ] │    │
│  │  [                             ] │    │
│  │  [          textarea            ] │    │
│  │  [                             ] │    │
│  │  [                             ] │    │
│  │                                  │    │
│  │                   글자수: 0/2000  │    │
│  └──────────────────────────────────┘    │
│                                          │
│              [ 완료하기 ]                │
└──────────────────────────────────────────┘
```

- 상단에 뽑은 조합을 항상 표시 (잊지 않도록)
- 가이드 질문 4개를 회색 플레이스홀더로 제공
- textarea는 최소 높이를 확보하되 내용에 따라 자동 확장
- 글자수 카운터 표시 (최소 50자 이상 작성해야 완료 가능)
- "완료하기" 버튼은 최소 글자수 충족 시 활성화

#### 화면 5: 완료 화면 (COMPLETE)

```
┌──────────────────────────────────────────┐
│                                          │
│              ✦ 완성! ✦                  │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  세계: "감정의 시간이 녹는 세계"   │    │
│  │  물건: "감정을 읽는, 물에 녹는 시계"│    │
│  │                                  │    │
│  │  "이 세계에서 사람들은 감정을      │    │
│  │   시간으로 환산하여 살아갑니다..." │    │
│  │                                  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  이 조합에 별점을 매겨주세요:             │
│  ☆ ☆ ☆ ☆ ☆                             │
│                                          │
│  [ 다시 하기 ]  [ 공유하기 ]  [ 히스토리 ] │
│                                          │
└──────────────────────────────────────────┘
```

- 작성한 세계관을 카드 형태로 깔끔하게 표시
- 별점 1~5점으로 자기 평가 (재미있었는지)
- "공유하기": 텍스트를 클립보드에 복사 (Web Share API 지원 시 네이티브 공유)
- "다시 하기": 시작 화면으로 복귀
- "히스토리": 과거 세션 목록 열람

#### 화면 6: 히스토리 화면

```
┌──────────────────────────────────────────┐
│  ← 돌아가기            📜 나의 기록들     │
│                                          │
│  총 12회 플레이 | 평균 ★ 3.8              │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  #12  2026-03-02                 │    │
│  │  "감정을 읽는, 물에 녹는 시계"     │    │
│  │  세계: 감정의 시간이 녹는 세계     │    │
│  │  ★★★★☆                          │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  #11  2026-03-01                 │    │
│  │  "노래하는, 한 번만 쓸 수 있는 열쇠"│    │
│  │  세계: 마지막 멜로디의 문           │    │
│  │  ★★★☆☆                          │    │
│  └──────────────────────────────────┘    │
│  ...                                     │
│                                          │
│            [ 전체 기록 삭제 ]             │
└──────────────────────────────────────────┘
```

---

## 3. 토큰 데이터 설계

### 3.1 빨간 주머니 - 물건 (Red Tokens)

| ID | label | emoji | difficulty | tags |
|----|-------|-------|-----------|------|
| red-001 | 우산 | ☂️ | 1 | 일상, 도구 |
| red-002 | 신발 | 👟 | 1 | 일상, 착용 |
| red-003 | 시계 | ⏰ | 1 | 일상, 도구 |
| red-004 | 안경 | 👓 | 1 | 일상, 착용 |
| red-005 | 의자 | 🪑 | 1 | 일상, 가구 |
| red-006 | 컵 | ☕ | 1 | 일상, 도구 |
| red-007 | 열쇠 | 🔑 | 1 | 일상, 도구 |
| red-008 | 베개 | 🛏️ | 1 | 일상, 가구 |
| red-009 | 거울 | 🪞 | 2 | 일상, 도구 |
| red-010 | 다리 | 🌉 | 2 | 건축, 구조물 |
| red-011 | 악기 | 🎸 | 2 | 예술, 도구 |
| red-012 | 지도 | 🗺️ | 2 | 탐험, 도구 |
| red-013 | 문 | 🚪 | 2 | 건축, 구조물 |
| red-014 | 씨앗 | 🌱 | 2 | 자연, 생물 |
| red-015 | 편지 | ✉️ | 2 | 소통, 도구 |
| red-016 | 가면 | 🎭 | 3 | 예술, 착용 |
| red-017 | 그림자 | 👤 | 3 | 추상, 자연현상 |
| red-018 | 계단 | 🪜 | 2 | 건축, 구조물 |
| red-019 | 주사위 | 🎲 | 2 | 놀이, 도구 |
| red-020 | 나침반 | 🧭 | 2 | 탐험, 도구 |

### 3.2 파란 주머니 - 속성 (Blue Tokens)

| ID | label | emoji | difficulty | tags |
|----|-------|-------|-----------|------|
| blue-001 | 투명한 | 👻 | 1 | 시각, 물리 |
| blue-002 | 날아다니는 | 🕊️ | 1 | 이동, 물리 |
| blue-003 | 노래하는 | 🎵 | 1 | 청각, 감각 |
| blue-004 | 시간을 되돌리는 | ⏪ | 3 | 시간, 초자연 |
| blue-005 | 감정을 읽는 | 💭 | 2 | 감각, 초자연 |
| blue-006 | 스스로 자라나는 | 🌿 | 2 | 생물, 변형 |
| blue-007 | 기억을 저장하는 | 🧠 | 2 | 정신, 초자연 |
| blue-008 | 온도를 바꾸는 | 🌡️ | 1 | 물리, 환경 |
| blue-009 | 말을 하는 | 🗣️ | 1 | 청각, 소통 |
| blue-010 | 꿈을 보여주는 | 💫 | 3 | 정신, 초자연 |
| blue-011 | 크기가 변하는 | 📏 | 2 | 물리, 변형 |
| blue-012 | 빛을 흡수하는 | 🌑 | 2 | 시각, 물리 |
| blue-013 | 생각을 전달하는 | 📡 | 2 | 소통, 초자연 |
| blue-014 | 중력을 무시하는 | 🪐 | 2 | 물리, 환경 |
| blue-015 | 거짓말을 감지하는 | 🔍 | 2 | 감각, 사회 |
| blue-016 | 날씨를 바꾸는 | ⛈️ | 3 | 환경, 초자연 |
| blue-017 | 언어를 번역하는 | 🌐 | 1 | 소통, 감각 |
| blue-018 | 냄새로 길을 안내하는 | 👃 | 2 | 감각, 이동 |
| blue-019 | 그림자를 조종하는 | 🌘 | 3 | 시각, 초자연 |
| blue-020 | 치유하는 | ❤️‍🩹 | 2 | 생물, 초자연 |

### 3.3 초록 주머니 - 제약 (Green Tokens)

| ID | label | emoji | difficulty | tags |
|----|-------|-------|-----------|------|
| green-001 | 그물망처럼 구멍이 뚫린 | 🕸️ | 1 | 형태, 물리 |
| green-002 | 물에 녹는 | 💧 | 1 | 소재, 환경 |
| green-003 | 밤에만 작동하는 | 🌙 | 1 | 시간, 조건 |
| green-004 | 한 번만 사용 가능한 | 1️⃣ | 2 | 횟수, 조건 |
| green-005 | 거꾸로 작동하는 | 🔄 | 2 | 방식, 역전 |
| green-006 | 사용할 때마다 작아지는 | 📉 | 2 | 변형, 소모 |
| green-007 | 만지면 뜨거운 | 🔥 | 1 | 감각, 위험 |
| green-008 | 주인의 비밀을 말하는 | 🤫 | 2 | 사회, 위험 |
| green-009 | 울 때만 작동하는 | 😢 | 2 | 감정, 조건 |
| green-010 | 다른 사람에게 보이지 않는 | 🫥 | 2 | 시각, 사회 |
| green-011 | 사용자의 수명을 갉아먹는 | ⏳ | 3 | 대가, 위험 |
| green-012 | 무작위로 순간이동하는 | 🎯 | 2 | 이동, 불안정 |
| green-013 | 비가 오면 거대해지는 | 🌧️ | 1 | 환경, 변형 |
| green-014 | 거짓말을 하면 깨지는 | 💔 | 2 | 도덕, 조건 |
| green-015 | 2명이 동시에 잡아야 하는 | 🤝 | 2 | 사회, 조건 |
| green-016 | 사용 후 1시간 기억을 잃는 | 🫠 | 3 | 대가, 정신 |
| green-017 | 행복할수록 무거워지는 | 😊 | 2 | 감정, 물리 |
| green-018 | 소리를 내면 사라지는 | 🤐 | 2 | 청각, 조건 |
| green-019 | 자신의 모습을 비추면 깨지는 | 💎 | 2 | 시각, 조건 |
| green-020 | 13일의 금요일에만 완전한 | 🗓️ | 3 | 시간, 조건 |

### 3.4 조합 밸런스 설계

#### 난이도 스코어 계산

```
combinedDifficulty = red.difficulty + blue.difficulty + green.difficulty
```

| 합산 점수 | 난이도 등급 | 별 표시 | 비율 목표 |
|-----------|------------|---------|-----------|
| 3 | Very Easy | ★☆☆☆☆ | 10% |
| 4 | Easy | ★★☆☆☆ | 20% |
| 5 | Normal | ★★★☆☆ | 35% |
| 6 | Hard | ★★★★☆ | 25% |
| 7~9 | Very Hard | ★★★★★ | 10% |

#### 밸런스 보장 방법

각 난이도 등급(1/2/3)의 토큰 수를 조절하여, 랜덤 균등 추첨 시 위 비율에 근사하도록 설계:

- difficulty 1 : 각 주머니에 7~8개 (약 35~40%)
- difficulty 2 : 각 주머니에 9~10개 (약 45~50%)
- difficulty 3 : 각 주머니에 2~3개 (약 10~15%)

극단적 조합(3+3+3=9) 출현 확률이 낮도록 difficulty 3 토큰의 수를 제한한다.

### 3.5 토큰 확장성

토큰 데이터는 별도의 JSON 구조로 관리하며, 다음 확장을 고려한다:

```javascript
// tokens.js 내 데이터 구조
const TOKEN_REGISTRY = {
  version: 1,
  pouches: {
    red: {
      name: "물건",
      color: "#E74C3C",
      tokens: [ /* Token[] */ ]
    },
    blue: {
      name: "속성",
      color: "#3498DB",
      tokens: [ /* Token[] */ ]
    },
    green: {
      name: "제약",
      color: "#2ECC71",
      tokens: [ /* Token[] */ ]
    }
  }
};
```

**확장 포인트:**
- 새 토큰 추가: 배열에 객체만 push하면 됨
- 새 주머니 추가: `pouches`에 새 키 추가 (예: `purple` 주머니 - "목적" 토큰)
- 테마팩: `version` 필드로 토큰 세트를 교체하거나 병합 가능
- 커스텀 토큰: 사용자가 자신만의 토큰을 만들어 추가하는 기능 확장 가능

---

## 4. 게임 흐름 상태 관리

### 4.1 상태 전환 다이어그램

```
                    ┌─────────────────────────────┐
                    │                             │
                    ▼                             │
              ┌──────────┐                        │
         ┌───►│   IDLE   │◄───────────────────┐   │
         │    └────┬─────┘                    │   │
         │         │ [게임 시작]               │   │
         │         ▼                          │   │
         │   ┌────────────┐                   │   │
         │   │DRAWING_RED │──[다시 뽑기]──►자기│   │
         │   └────┬───────┘                   │   │
         │        │ [토큰 확정]                │   │
         │        ▼                           │   │
         │   ┌─────────────┐                  │   │
         │   │DRAWING_BLUE │──[다시 뽑기]──►자기│   │
         │   └────┬────────┘                  │   │
         │        │ [토큰 확정]                │   │
         │        ▼                           │   │
         │   ┌──────────────┐                 │   │
         │   │DRAWING_GREEN │──[다시 뽑기]──►자기│  │
         │   └────┬─────────┘                 │   │
         │        │ [토큰 확정]                │   │
         │        ▼                           │   │
         │   ┌──────────┐                     │   │
         │   │  REVIEW  │─────[다시 조합]─────┘   │
         │   └────┬─────┘                         │
         │        │ [세계 상상하기]                  │
         │        ▼                               │
         │   ┌──────────┐                         │
         │   │ WRITING  │─────[뒤로]──►REVIEW     │
         │   └────┬─────┘                         │
         │        │ [완료하기]                      │
         │        ▼                               │
         │   ┌──────────┐                         │
         └───│ COMPLETE │─────[히스토리]──►HISTORY │
             └──────────┘                         │
                  │                               │
                  └──────[다시 하기]───────────────┘
```

### 4.2 상태 전환 로직 (의사코드)

```javascript
function transition(currentPhase, action) {
  switch (currentPhase) {
    case 'IDLE':
      if (action === 'START_GAME') return 'DRAWING_RED';
      if (action === 'VIEW_HISTORY') return 'HISTORY';
      break;

    case 'DRAWING_RED':
      if (action === 'DRAW_TOKEN') {
        // 빨간 토큰을 뽑아 drawnTokens.red에 저장
        return 'DRAWING_RED'; // 애니메이션 중 동일 상태 유지
      }
      if (action === 'CONFIRM_TOKEN') return 'DRAWING_BLUE';
      if (action === 'REDRAW') {
        // redrawCount.red < 1 인 경우만 허용
        // drawnTokens.red 초기화
        return 'DRAWING_RED';
      }
      break;

    case 'DRAWING_BLUE':
      if (action === 'DRAW_TOKEN') return 'DRAWING_BLUE';
      if (action === 'CONFIRM_TOKEN') return 'DRAWING_GREEN';
      if (action === 'REDRAW') return 'DRAWING_BLUE';
      break;

    case 'DRAWING_GREEN':
      if (action === 'DRAW_TOKEN') return 'DRAWING_GREEN';
      if (action === 'CONFIRM_TOKEN') return 'REVIEW';
      if (action === 'REDRAW') return 'DRAWING_GREEN';
      break;

    case 'REVIEW':
      if (action === 'START_WRITING') return 'WRITING';
      if (action === 'RESTART') return 'IDLE'; // 다시 조합하기
      break;

    case 'WRITING':
      if (action === 'COMPLETE') {
        // 세션을 히스토리에 저장
        return 'COMPLETE';
      }
      if (action === 'BACK') return 'REVIEW';
      break;

    case 'COMPLETE':
      if (action === 'RESTART') return 'IDLE';
      if (action === 'VIEW_HISTORY') return 'HISTORY';
      break;

    case 'HISTORY':
      if (action === 'BACK') return previousPhase; // 진입 전 상태로 복귀
      break;
  }
  return currentPhase; // 유효하지 않은 전환은 무시
}
```

### 4.3 다시 뽑기 (Redraw) 로직

```javascript
const redrawState = {
  red: { used: false, maxRedraws: 1 },
  blue: { used: false, maxRedraws: 1 },
  green: { used: false, maxRedraws: 1 }
};
```

- 각 주머니당 1회 다시 뽑기 가능
- 다시 뽑기 시, 직전에 뽑은 토큰은 제외하고 뽑음 (같은 토큰 재등장 방지)
- 다시 뽑기 버튼 옆에 남은 횟수 표시: "다시 뽑기 (1회 남음)" / "다시 뽑기 불가"
- 다시 뽑기 사용 시 버튼 비활성화 + 시각적 피드백

### 4.4 히스토리 저장 (localStorage)

#### 저장 키

```
localStorage key: "nova-pouch-history"
```

#### 저장/불러오기 API

```javascript
// history.js

const STORAGE_KEY = 'nova-pouch-history';
const MAX_SESSIONS = 100; // 최대 저장 세션 수

function loadHistory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyHistory();
  try {
    const data = JSON.parse(raw);
    return migrateIfNeeded(data);
  } catch {
    return createEmptyHistory();
  }
}

function saveSession(session) {
  const history = loadHistory();
  history.sessions.unshift(session); // 최신순 정렬
  if (history.sessions.length > MAX_SESSIONS) {
    history.sessions = history.sessions.slice(0, MAX_SESSIONS);
  }
  updateStats(history);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function deleteAllHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

function createEmptyHistory() {
  return {
    version: 1,
    sessions: [],
    stats: { totalPlayed: 0, averageRating: 0, favoriteTokens: {} }
  };
}

function migrateIfNeeded(data) {
  // version 필드 기반 마이그레이션 로직
  // 향후 스키마 변경 시 여기서 처리
  return data;
}

function updateStats(history) {
  const sessions = history.sessions;
  history.stats.totalPlayed = sessions.length;
  history.stats.averageRating = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + (s.rating || 0), 0) / sessions.length
    : 0;
  // favoriteTokens 빈도 계산
  const freq = {};
  sessions.forEach(s => {
    Object.values(s.tokens).forEach(t => {
      freq[t.id] = (freq[t.id] || 0) + 1;
    });
  });
  history.stats.favoriteTokens = freq;
}
```

#### 용량 관리

- 세션 1건 당 약 500 bytes 추정
- 100건 제한 시 약 50KB (localStorage 5MB 한도 대비 충분)
- 100건 초과 시 가장 오래된 세션부터 자동 삭제

### 4.5 전체 상태 객체 요약

```javascript
const gameState = {
  // 현재 단계
  phase: 'IDLE',

  // 뽑힌 토큰
  drawnTokens: {
    red: null,    // Token | null
    blue: null,   // Token | null
    green: null   // Token | null
  },

  // 다시 뽑기 상태
  redraws: {
    red: 0,     // 사용한 다시 뽑기 횟수
    blue: 0,
    green: 0
  },

  // 직전에 뽑은 토큰 (다시 뽑기 시 제외용)
  lastDrawn: {
    red: null,
    blue: null,
    green: null
  },

  // 사용자 입력
  worldName: '',
  userStory: '',
  rating: 0,

  // UI 상태
  isAnimating: false,    // 애니메이션 진행 중 인터랙션 차단
  previousPhase: null    // 히스토리에서 돌아갈 상태
};
```

---

## 5. 기술 결정 사항 요약

| 항목 | 결정 | 근거 |
|------|------|------|
| 프레임워크 | Vanilla JS (No framework) | 단순한 SPA, 외부 의존성 최소화 |
| 스타일링 | CSS 커스텀 속성 + BEM 네이밍 | 유지보수성, 테마 확장성 |
| 빌드 도구 | 없음 (ESM import 직접 사용) | 개발 복잡도 최소화 |
| 상태 관리 | 커스텀 옵저버 패턴 | 경량, 프레임워크 불필요 |
| 데이터 저장 | localStorage | 서버 불필요, 오프라인 지원 |
| 애니메이션 | CSS animation + JS 트리거 | 성능, 선언적 관리 |
| 반응형 | 모바일 퍼스트 | 터치 인터랙션 우선 |
| 접근성 | ARIA 속성, 키보드 네비게이션 | 포용적 설계 |

---

## 6. 핵심 인터랙션 상세 - 주머니 뽑기

주머니 뽑기는 이 게임의 핵심 경험이므로 상세하게 설계한다.

### 6.1 터치/클릭 인터랙션 흐름

```
[대기 상태]
  주머니: idle 흔들림 애니메이션 (미세한 좌우 흔들림, 3초 주기)
     │
     │ 사용자 탭/클릭
     ▼
[흔들기 상태]  (0.6초)
  주머니: 격렬한 흔들림 애니메이션
  효과음: 주머니 흔드는 소리 (선택)
  입력: 비활성화 (중복 탭 방지)
     │
     │ 애니메이션 종료
     ▼
[열기 상태]  (0.4초)
  주머니: 입구가 벌어지는 애니메이션
  토큰: 주머니 위로 살짝 보이기 시작
     │
     │ 애니메이션 종료
     ▼
[토큰 공개 상태]  (0.8초)
  토큰: 주머니 위로 떠오르며 화면 중앙으로 이동
  토큰: 카드 뒤집기(flip) 애니메이션으로 내용 공개
  주머니: 뒤로 물러나며 축소
     │
     │ 애니메이션 종료
     ▼
[확정 대기 상태]
  토큰: 화면 중앙에 크게 표시
  버튼: [확인] [다시 뽑기 (n회 남음)]
  하단: 이전에 뽑은 토큰 슬롯 표시
```

### 6.2 CSS 애니메이션 계획

```css
/* 주머니 idle 흔들림 */
@keyframes pouch-idle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-2deg); }
  75% { transform: rotate(2deg); }
}

/* 주머니 격렬한 흔들림 */
@keyframes pouch-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px) rotate(-2deg); }
  20%, 40%, 60%, 80% { transform: translateX(4px) rotate(2deg); }
}

/* 토큰 떠오르기 */
@keyframes token-rise {
  from { transform: translateY(100px) scale(0.5); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

/* 토큰 카드 뒤집기 */
@keyframes token-flip {
  0% { transform: rotateY(180deg); }
  100% { transform: rotateY(0deg); }
}
```

---

## 7. 향후 확장 고려사항

1. **멀티플레이어 모드**: 같은 조합을 여러 사람이 동시에 받고, 각자 다른 세계관을 작성한 뒤 투표
2. **AI 피드백**: 작성한 세계관에 대해 AI가 질문하거나 디테일을 요청
3. **테마팩**: 시즌별 토큰 세트 (SF, 판타지, 일상 등)
4. **도전 모드**: 타이머 제한, 난이도 고정 등
5. **갤러리**: 다른 사용자들의 세계관을 열람하는 공유 게시판
6. **업적 시스템**: 특정 조합을 달성하거나 N회 이상 플레이 시 배지 부여
