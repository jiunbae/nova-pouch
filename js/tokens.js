/* ============================================================
   tokens.js — Token Data Registry & Selection Logic
   ============================================================ */

import { weightedPick } from './utils.js';
import { getLocale } from './i18n.js';

/**
 * TOKEN_REGISTRY
 * 60 tokens across 3 pouches (red/blue/green), 20 each.
 * Each pouch represents a dimensional plane:
 *   - red (물질계): Objects
 *   - blue (성질계): Properties
 *   - green (규율계): Constraints
 */
export const TOKEN_REGISTRY = {
  version: 1,
  pouches: {
    red: {
      name: '물건',
      lore: '물질계',
      color: '#FF4B2B',
      tokens: [
        { id: 'red-001', label: '우산',   labelEn: 'umbrella',   emoji: '\u2602\uFE0F', difficulty: 1, tags: ['일상', '도구'] },
        { id: 'red-002', label: '신발',   labelEn: 'shoes',      emoji: '\uD83D\uDC5F', difficulty: 1, tags: ['일상', '착용'] },
        { id: 'red-003', label: '시계',   labelEn: 'clock',      emoji: '\u23F0',       difficulty: 1, tags: ['일상', '도구'] },
        { id: 'red-004', label: '안경',   labelEn: 'glasses',    emoji: '\uD83D\uDC53', difficulty: 1, tags: ['일상', '착용'] },
        { id: 'red-005', label: '의자',   labelEn: 'chair',      emoji: '\uD83E\uDE91', difficulty: 1, tags: ['일상', '가구'] },
        { id: 'red-006', label: '컵',     labelEn: 'cup',        emoji: '\u2615',       difficulty: 1, tags: ['일상', '도구'] },
        { id: 'red-007', label: '열쇠',   labelEn: 'key',        emoji: '\uD83D\uDD11', difficulty: 1, tags: ['일상', '도구'] },
        { id: 'red-008', label: '베개',   labelEn: 'pillow',     emoji: '\uD83D\uDECF\uFE0F', difficulty: 1, tags: ['일상', '가구'] },
        { id: 'red-009', label: '거울',   labelEn: 'mirror',     emoji: '\uD83E\uDE9E', difficulty: 2, tags: ['일상', '도구'] },
        { id: 'red-010', label: '다리',   labelEn: 'bridge',     emoji: '\uD83C\uDF09', difficulty: 2, tags: ['건축', '구조물'] },
        { id: 'red-011', label: '악기',   labelEn: 'instrument', emoji: '\uD83C\uDFB8', difficulty: 2, tags: ['예술', '도구'] },
        { id: 'red-012', label: '지도',   labelEn: 'map',        emoji: '\uD83D\uDDFA\uFE0F', difficulty: 2, tags: ['탐험', '도구'] },
        { id: 'red-013', label: '문',     labelEn: 'door',       emoji: '\uD83D\uDEAA', difficulty: 2, tags: ['건축', '구조물'] },
        { id: 'red-014', label: '씨앗',   labelEn: 'seed',       emoji: '\uD83C\uDF31', difficulty: 2, tags: ['자연', '생물'] },
        { id: 'red-015', label: '편지',   labelEn: 'letter',     emoji: '\u2709\uFE0F', difficulty: 2, tags: ['소통', '도구'] },
        { id: 'red-016', label: '가면',   labelEn: 'mask',       emoji: '\uD83C\uDFAD', difficulty: 3, tags: ['예술', '착용'] },
        { id: 'red-017', label: '그림자', labelEn: 'shadow',     emoji: '\uD83D\uDC64', difficulty: 3, tags: ['추상', '자연현상'] },
        { id: 'red-018', label: '계단',   labelEn: 'staircase',  emoji: '\uD83E\uDE9C', difficulty: 2, tags: ['건축', '구조물'] },
        { id: 'red-019', label: '주사위', labelEn: 'dice',       emoji: '\uD83C\uDFB2', difficulty: 2, tags: ['놀이', '도구'] },
        { id: 'red-020', label: '나침반', labelEn: 'compass',    emoji: '\uD83E\uDDED', difficulty: 2, tags: ['탐험', '도구'] },
      ],
    },
    blue: {
      name: '속성',
      lore: '성질계',
      color: '#00D2FF',
      tokens: [
        { id: 'blue-001', label: '투명한',           labelEn: 'transparent',           emoji: '\uD83D\uDC7B', difficulty: 1, tags: ['시각', '물리'] },
        { id: 'blue-002', label: '날아다니는',       labelEn: 'flying',                emoji: '\uD83D\uDD4A\uFE0F', difficulty: 1, tags: ['이동', '물리'] },
        { id: 'blue-003', label: '노래하는',         labelEn: 'singing',               emoji: '\uD83C\uDFB5', difficulty: 1, tags: ['청각', '감각'] },
        { id: 'blue-004', label: '시간을 되돌리는',  labelEn: 'time-reversing',        emoji: '\u23EA',       difficulty: 3, tags: ['시간', '초자연'] },
        { id: 'blue-005', label: '감정을 읽는',      labelEn: 'emotion-reading',       emoji: '\uD83D\uDCAD', difficulty: 2, tags: ['감각', '초자연'] },
        { id: 'blue-006', label: '스스로 자라나는',   labelEn: 'self-growing',          emoji: '\uD83C\uDF3F', difficulty: 2, tags: ['생물', '변형'] },
        { id: 'blue-007', label: '기억을 저장하는',  labelEn: 'memory-storing',        emoji: '\uD83E\uDDE0', difficulty: 2, tags: ['정신', '초자연'] },
        { id: 'blue-008', label: '온도를 바꾸는',    labelEn: 'temperature-changing',  emoji: '\uD83C\uDF21\uFE0F', difficulty: 1, tags: ['물리', '환경'] },
        { id: 'blue-009', label: '말을 하는',        labelEn: 'talking',               emoji: '\uD83D\uDDE3\uFE0F', difficulty: 1, tags: ['청각', '소통'] },
        { id: 'blue-010', label: '꿈을 보여주는',    labelEn: 'dream-showing',         emoji: '\uD83D\uDCAB', difficulty: 3, tags: ['정신', '초자연'] },
        { id: 'blue-011', label: '크기가 변하는',    labelEn: 'size-shifting',         emoji: '\uD83D\uDCCF', difficulty: 2, tags: ['물리', '변형'] },
        { id: 'blue-012', label: '빛을 흡수하는',    labelEn: 'light-absorbing',       emoji: '\uD83C\uDF11', difficulty: 2, tags: ['시각', '물리'] },
        { id: 'blue-013', label: '생각을 전달하는',  labelEn: 'thought-transmitting',  emoji: '\uD83D\uDCE1', difficulty: 2, tags: ['소통', '초자연'] },
        { id: 'blue-014', label: '중력을 무시하는',  labelEn: 'gravity-defying',       emoji: '\uD83E\uDE90', difficulty: 2, tags: ['물리', '환경'] },
        { id: 'blue-015', label: '거짓말을 감지하는', labelEn: 'lie-detecting',         emoji: '\uD83D\uDD0D', difficulty: 2, tags: ['감각', '사회'] },
        { id: 'blue-016', label: '날씨를 바꾸는',    labelEn: 'weather-changing',      emoji: '\u26C8\uFE0F', difficulty: 3, tags: ['환경', '초자연'] },
        { id: 'blue-017', label: '언어를 번역하는',  labelEn: 'language-translating',  emoji: '\uD83C\uDF10', difficulty: 1, tags: ['소통', '감각'] },
        { id: 'blue-018', label: '냄새로 길을 안내하는', labelEn: 'scent-guiding',     emoji: '\uD83D\uDC43', difficulty: 2, tags: ['감각', '이동'] },
        { id: 'blue-019', label: '그림자를 조종하는', labelEn: 'shadow-controlling',   emoji: '\uD83C\uDF18', difficulty: 3, tags: ['시각', '초자연'] },
        { id: 'blue-020', label: '치유하는',         labelEn: 'healing',               emoji: '\u2764\uFE0F\u200D\uD83E\uDE79', difficulty: 2, tags: ['생물', '초자연'] },
      ],
    },
    green: {
      name: '제약',
      lore: '규율계',
      color: '#5DFFAB',
      tokens: [
        { id: 'green-001', label: '그물망처럼 구멍이 뚫린',    labelEn: 'full of holes',                emoji: '\uD83D\uDD78\uFE0F', difficulty: 1, tags: ['형태', '물리'] },
        { id: 'green-002', label: '물에 녹는',                 labelEn: 'dissolves in water',           emoji: '\uD83D\uDCA7', difficulty: 1, tags: ['소재', '환경'] },
        { id: 'green-003', label: '밤에만 작동하는',            labelEn: 'only works at night',          emoji: '\uD83C\uDF19', difficulty: 1, tags: ['시간', '조건'] },
        { id: 'green-004', label: '한 번만 사용 가능한',        labelEn: 'single-use',                   emoji: '1\uFE0F\u20E3', difficulty: 2, tags: ['횟수', '조건'] },
        { id: 'green-005', label: '거꾸로 작동하는',            labelEn: 'works in reverse',             emoji: '\uD83D\uDD04', difficulty: 2, tags: ['방식', '역전'] },
        { id: 'green-006', label: '사용할 때마다 작아지는',      labelEn: 'shrinks with each use',        emoji: '\uD83D\uDCC9', difficulty: 2, tags: ['변형', '소모'] },
        { id: 'green-007', label: '만지면 뜨거운',              labelEn: 'burns when touched',           emoji: '\uD83D\uDD25', difficulty: 1, tags: ['감각', '위험'] },
        { id: 'green-008', label: '주인의 비밀을 말하는',       labelEn: "reveals owner's secrets",      emoji: '\uD83E\uDD2B', difficulty: 2, tags: ['사회', '위험'] },
        { id: 'green-009', label: '울 때만 작동하는',           labelEn: 'only works when crying',       emoji: '\uD83D\uDE22', difficulty: 2, tags: ['감정', '조건'] },
        { id: 'green-010', label: '다른 사람에게 보이지 않는',   labelEn: 'invisible to others',          emoji: '\uD83E\uDEE5', difficulty: 2, tags: ['시각', '사회'] },
        { id: 'green-011', label: '사용자의 수명을 갉아먹는',   labelEn: "drains user's lifespan",       emoji: '\u23F3',       difficulty: 3, tags: ['대가', '위험'] },
        { id: 'green-012', label: '무작위로 순간이동하는',       labelEn: 'randomly teleports',           emoji: '\uD83C\uDFAF', difficulty: 2, tags: ['이동', '불안정'] },
        { id: 'green-013', label: '비가 오면 거대해지는',        labelEn: 'grows huge in rain',           emoji: '\uD83C\uDF27\uFE0F', difficulty: 1, tags: ['환경', '변형'] },
        { id: 'green-014', label: '거짓말을 하면 깨지는',       labelEn: 'breaks when you lie',          emoji: '\uD83D\uDC94', difficulty: 2, tags: ['도덕', '조건'] },
        { id: 'green-015', label: '2명이 동시에 잡아야 하는',   labelEn: 'requires two holders',         emoji: '\uD83E\uDD1D', difficulty: 2, tags: ['사회', '조건'] },
        { id: 'green-016', label: '사용 후 1시간 기억을 잃는',  labelEn: 'causes 1-hour memory loss',    emoji: '\uD83E\uDEE0', difficulty: 3, tags: ['대가', '정신'] },
        { id: 'green-017', label: '행복할수록 무거워지는',       labelEn: 'heavier when happy',           emoji: '\uD83D\uDE0A', difficulty: 2, tags: ['감정', '물리'] },
        { id: 'green-018', label: '소리를 내면 사라지는',       labelEn: 'vanishes if you make sound',   emoji: '\uD83E\uDD10', difficulty: 2, tags: ['청각', '조건'] },
        { id: 'green-019', label: '자신의 모습을 비추면 깨지는', labelEn: 'shatters when reflecting self', emoji: '\uD83D\uDC8E', difficulty: 2, tags: ['시각', '조건'] },
        { id: 'green-020', label: '13일의 금요일에만 완전한',   labelEn: 'only whole on Friday the 13th', emoji: '\uD83D\uDCC6\uFE0F', difficulty: 3, tags: ['시간', '조건'] },
      ],
    },
  },
};

/**
 * Get all tokens for a specific pouch type.
 * @param {'red'|'blue'|'green'} pouchType
 * @returns {Array} Array of token objects
 */
export function getTokensByPouch(pouchType) {
  const pouch = TOKEN_REGISTRY.pouches[pouchType];
  if (!pouch) {
    throw new Error(`Unknown pouch type: ${pouchType}`);
  }
  return pouch.tokens;
}

/**
 * Get pouch metadata (name, lore, color).
 * @param {'red'|'blue'|'green'} pouchType
 * @returns {{ name: string, lore: string, color: string }}
 */
export function getPouchMeta(pouchType) {
  const pouch = TOKEN_REGISTRY.pouches[pouchType];
  if (!pouch) {
    throw new Error(`Unknown pouch type: ${pouchType}`);
  }
  return { name: pouch.name, lore: pouch.lore, color: pouch.color };
}

/**
 * Randomly select a token from the given pouch, optionally excluding one.
 * Uses weighted pick based on difficulty (higher difficulty = rarer).
 * Weight formula: 4 - difficulty (so diff 1 => weight 3, diff 2 => 2, diff 3 => 1)
 * @param {'red'|'blue'|'green'} pouchType
 * @param {string|null} excludeId - Token ID to exclude (for redraw)
 * @returns {Object} Selected token object
 */
export function getRandomToken(pouchType, excludeId = null) {
  const tokens = getTokensByPouch(pouchType);
  const candidates = excludeId
    ? tokens.filter(t => t.id !== excludeId)
    : tokens;

  return weightedPick(
    candidates,
    (token) => 4 - token.difficulty, // diff 1->3, diff 2->2, diff 3->1
  );
}

/**
 * Format a combination of tokens into a descriptive string.
 * Korean order: "{green.label} {blue.label} {red.label}" (제약 속성 물건, no comma)
 * English order: "{blue.labelEn}, {green.labelEn} {red.labelEn}" (property, constraint noun)
 * @param {{ red: Object, blue: Object, green: Object }} tokens
 * @returns {string}
 */
export function formatCombo(tokens) {
  if (!tokens.red || !tokens.blue || !tokens.green) {
    return '';
  }
  if (getLocale() === 'en') {
    return `${tokens.blue.labelEn || tokens.blue.label}, ${tokens.green.labelEn || tokens.green.label} ${tokens.red.labelEn || tokens.red.label}`;
  }
  return `${tokens.green.label} ${tokens.blue.label} ${tokens.red.label}`;
}

/**
 * Calculate combined difficulty and return grade info.
 * Sum = red.difficulty + blue.difficulty + green.difficulty
 *   3  : Very Easy  (1 star)
 *   4  : Easy       (2 stars)
 *   5  : Normal     (3 stars)
 *   6  : Hard       (4 stars)
 *   7-9: Very Hard  (5 stars)
 * @param {{ red: Object, blue: Object, green: Object }} tokens
 * @returns {{ sum: number, stars: number, label: string }}
 */
export function calculateDifficulty(tokens) {
  if (!tokens.red || !tokens.blue || !tokens.green) {
    return { sum: 0, stars: 0, label: '' };
  }

  const sum = tokens.red.difficulty + tokens.blue.difficulty + tokens.green.difficulty;

  let stars, label;
  if (sum <= 3) {
    stars = 1;
    label = 'Very Easy';
  } else if (sum === 4) {
    stars = 2;
    label = 'Easy';
  } else if (sum === 5) {
    stars = 3;
    label = 'Normal';
  } else if (sum === 6) {
    stars = 4;
    label = 'Hard';
  } else {
    stars = 5;
    label = 'Very Hard';
  }

  return { sum, stars, label };
}

/**
 * Generate difficulty stars HTML string.
 * @param {number} stars - Number of filled stars (1-5)
 * @returns {string} HTML string with star spans
 */
export function renderDifficultyStars(stars) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= stars) {
      html += '<span class="star-filled">\u2605</span>';
    } else {
      html += '<span class="star-empty">\u2606</span>';
    }
  }
  return html;
}
