import { gameState, ACTIONS } from './state.js';
import { initRenderer, refreshLocale } from './renderer.js';
import { initPouch } from './pouch.js';
import { loadHistory, saveSession, deleteAllHistory } from './history.js';
import { formatCombo, calculateDifficulty, TOKEN_REGISTRY } from './tokens.js';
import { debounce, generateId, formatDate } from './utils.js';
import { initI18n, setLocale, getLocale, t, updateDOM } from './i18n.js';

const MIN_STORY_LENGTH = 50;
const MAX_STORY_LENGTH = 2000;

document.addEventListener('DOMContentLoaded', () => {
  bootstrap();
});

function bootstrap() {
  initI18n();
  updateDOM();

  initRenderer(gameState, loadHistory);

  if (typeof gameState?.subscribe === 'function') {
    gameState.subscribe((state) => {
      syncStarsFromState(state);
      syncWritingValidation(state?.userStory || '');
    });
  }

  const history = loadHistory();
  updateHistoryPreview(history);

  initPouch(gameState);
  initHistoryNavigation(gameState);
  bindAllButtons();
  bindLangToggle();
  bindRatingStars();
  bindShareButton();
  bindWritingInputs();
  applyAccessibilityLabels();
}

const FORWARD_ACTIONS = new Set([
  ACTIONS.START_GAME,
  ACTIONS.CONFIRM_TOKEN,
  ACTIONS.START_WRITING,
  ACTIONS.COMPLETE,
]);

function initHistoryNavigation(stateInstance) {
  let isHandlingPopState = false;

  window.addEventListener('popstate', () => {
    isHandlingPopState = true;
    stateInstance.dispatch(ACTIONS.GO_BACK);
    isHandlingPopState = false;
  });

  stateInstance.subscribe((_state, action) => {
    if (isHandlingPopState) return;
    if (FORWARD_ACTIONS.has(action)) {
      history.pushState(null, '');
    }
  });
}

function bindAllButtons() {
  // Start game
  bindButtons(['[data-action="start-game"]', '#btn-start'], () => {
    dispatchAction('START_GAME');
  });

  // Write (from review step)
  bindButtons(['[data-action="start-writing"]', '#step-btn-write'], () => {
    dispatchAction('START_WRITING');
  });

  // Complete (writing step)
  bindButtons(['[data-action="complete"]', '#step-btn-complete'], async (event) => {
    event.preventDefault();

    const storyText = getStoryText();
    if (!isStoryValid(storyText)) {
      syncWritingValidation(storyText, true);
      announce(t('announce.minLength'));
      focusStoryInput();
      return;
    }

    const worldName = getWorldName();
    const sessionSnapshot = readState();

    dispatchAction('UPDATE_WORLD_NAME', worldName);
    dispatchAction('UPDATE_STORY', storyText);
    const session = createSession(sessionSnapshot, worldName, storyText);
    dispatchAction('COMPLETE');
    const history = saveSession(session);
    updateHistoryPreview(history);
  });

  // Restart (from complete step)
  bindButtons(['[data-action="restart"]', '#step-btn-restart'], () => {
    dispatchAction('RESTART');
  });

  // History — open overlay
  bindButtons(['[data-action="view-history"]', '#btn-history-idle', '#step-btn-history'], () => {
    dispatchAction('VIEW_HISTORY');
    updateHistoryPreview(loadHistory());
  });

  // History — close overlay
  bindButtons(['#btn-close-history'], () => {
    dispatchAction('CLOSE_HISTORY');
  });

  // Delete all history
  bindButtons(['[data-action="delete-history"]', '#btn-delete-all'], () => {
    const confirmed = window.confirm(t('confirm.deleteAll'));
    if (!confirmed) {
      return;
    }

    const history = deleteAllHistory();
    updateHistoryPreview(history);
    announce(t('announce.deleted'));
  });
}

function bindLangToggle() {
  const btn = document.getElementById('btn-lang-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = getLocale() === 'ko' ? 'en' : 'ko';
    setLocale(next);
    updateDOM();
    refreshLocale();
  });
}

function bindRatingStars() {
  const stars = queryAll(
    '#step-star-rating .star',
    '[data-rating-value]',
    '.rating-star[data-value]',
    '.rating-stars button'
  );

  stars.forEach((star, index) => {
    if (star.dataset.boundStar === 'true') {
      return;
    }

    star.dataset.boundStar = 'true';

    const ratingValue = getRatingValue(star, index + 1);
    star.dataset.ratingValue = String(ratingValue);
    star.setAttribute('aria-label', t('aria.starRate', { n: ratingValue }));

    star.addEventListener('click', () => {
      setRating(ratingValue);
    });

    if (!isNativeKeyboardButton(star)) {
      star.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setRating(ratingValue);
        }
      });
    }
  });

  syncStarsFromState(readState());
}

function bindShareButton() {
  bindButtons(['[data-action="share"]', '#step-btn-share'], async (event) => {
    event.preventDefault();

    const state = readState();
    const shareText = buildShareText(state);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        announce(t('announce.copied'));
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: t('share.shareTitle'),
          text: shareText
        });
        return;
      }

      announce(t('announce.noShare'));
    } catch {
      announce(t('announce.shareError'));
    }
  });
}

function bindWritingInputs() {
  const storyInput = queryFirst('#step-input-story', '[data-field="user-story"]', 'textarea[name="userStory"]');

  if (storyInput) {
    storyInput.setAttribute('maxlength', String(MAX_STORY_LENGTH));
    storyInput.setAttribute('aria-label', storyInput.getAttribute('aria-label') || t('aria.storyInput'));

    const onStoryInput = debounce(() => {
      autoResizeTextarea(storyInput);
      const story = storyInput.value || '';
      syncWritingValidation(story);
      dispatchAction('UPDATE_STORY', story);
    }, 80);

    storyInput.addEventListener('input', onStoryInput);
    autoResizeTextarea(storyInput);
    syncWritingValidation(storyInput.value || '');
  }
}

function createSession(state, worldName, storyText) {
  const now = new Date().toISOString();
  const tokens = state?.drawnTokens || {};

  const difficultyResult = calculateDifficultySafely(tokens);

  return {
    id: generateIdSafe(),
    createdAt: state?.createdAt || now,
    completedAt: now,
    tokens: {
      red: normalizeToken(tokens.red),
      blue: normalizeToken(tokens.blue),
      green: normalizeToken(tokens.green)
    },
    combinedDifficulty: difficultyResult,
    worldName: t('complete.noName'),
    userStory: (storyText || '').trim(),
    rating: Number(state?.rating) || 0
  };
}

function calculateDifficultySafely(tokensObj) {
  try {
    const result = calculateDifficulty(tokensObj);

    if (typeof result === 'number') {
      return result;
    }

    if (result && typeof result === 'object') {
      if (typeof result.sum === 'number') {
        return result.sum;
      }

      if (typeof result.total === 'number') {
        return result.total;
      }
    }

    return 0;
  } catch {
    return 0;
  }
}

function buildShareText(state) {
  const tokens = state?.drawnTokens || {};

  let comboText = '';
  try {
    comboText = formatCombo(tokens);
  } catch {
    const tokenList = [tokens.red, tokens.blue, tokens.green].filter(Boolean);
    comboText = tokenList.map((token) => token?.label).filter(Boolean).join(', ');
  }

  return [
    t('share.title'),
    t('share.world', { name: state?.worldName || t('complete.noName') }),
    t('share.fragment', { combo: comboText || t('share.noCombo') }),
    t('share.record', { story: (state?.userStory || '').trim() })
  ].join('\n');
}

function setRating(ratingValue) {
  const value = Math.max(1, Math.min(5, Number(ratingValue) || 0));
  if (!value) {
    return;
  }

  dispatchAction('SET_RATING', value);
  syncStars(value);
}

function syncStarsFromState(state) {
  syncStars(Number(state?.rating) || 0);
}

function syncStars(currentRating) {
  const stars = queryAll('#step-star-rating .star', '[data-rating-value]', '.rating-star[data-value]', '.rating-stars button');

  stars.forEach((star, index) => {
    const starValue = getRatingValue(star, index + 1);
    const active = starValue <= currentRating;

    star.classList.toggle('is-active', active);
    star.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function syncWritingValidation(storyText, forceError = false) {
  const trimmedLength = (storyText || '').trim().length;
  const valid = trimmedLength >= MIN_STORY_LENGTH;

  const counter = queryFirst('#step-char-count', '[data-role="story-count"]');
  if (counter) {
    counter.textContent = trimmedLength;
    counter.setAttribute('aria-live', 'polite');
  }

  const completeButtons = queryAll('[data-action="complete"]', '#step-btn-complete');
  completeButtons.forEach((button) => {
    button.disabled = !valid;
    button.setAttribute('aria-disabled', valid ? 'false' : 'true');
    button.setAttribute('aria-label', button.getAttribute('aria-label') || t('aria.complete'));
  });

  const storyInput = queryFirst('#step-input-story', '[data-field="user-story"]', 'textarea[name="userStory"]');
  if (storyInput) {
    storyInput.setCustomValidity(valid || !forceError ? '' : t('announce.minLength'));
  }
}

function autoResizeTextarea(textarea) {
  if (!textarea) {
    return;
  }

  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(textarea.scrollHeight, 120)}px`;
}

function getWorldName() {
  return '';
}

function getStoryText() {
  const storyInput = queryFirst('#step-input-story', '[data-field="user-story"]', 'textarea[name="userStory"]');
  return (storyInput?.value || '').trim();
}

function isStoryValid(storyText) {
  return (storyText || '').trim().length >= MIN_STORY_LENGTH;
}

function focusStoryInput() {
  const storyInput = queryFirst('#step-input-story', '[data-field="user-story"]', 'textarea[name="userStory"]');
  if (storyInput) {
    storyInput.focus();
  }
}

function updateHistoryPreview(history) {
  const totalElement = queryFirst('#stats-total', '[data-history-stat="totalPlayed"]');
  const averageElement = queryFirst('#stats-avg-rating', '[data-history-stat="averageRating"]');
  const listElement = queryFirst('#history-list', '[data-role="history-list"]');

  if (totalElement) {
    totalElement.textContent = String(history?.stats?.totalPlayed || 0);
  }

  if (averageElement) {
    averageElement.textContent = String(history?.stats?.averageRating || 0);
  }

  if (listElement) {
    listElement.textContent = '';

    (history?.sessions || []).slice(0, 10).forEach((session, index) => {
      const item = document.createElement('li');
      item.className = 'history-item';

      const combo = buildSessionCombo(session);
      item.textContent = `#${history.sessions.length - index} ${formatDateSafe(session.completedAt)} \u00B7 ${combo} \u00B7 \u2605${session.rating || 0}`;

      listElement.appendChild(item);
    });
  }
}

function buildSessionCombo(session) {
  const tokens = session?.tokens || {};

  try {
    return formatCombo(tokens);
  } catch {
    const tokenList = [tokens.red, tokens.blue, tokens.green].filter(Boolean);
    return tokenList.map((token) => token.label).join(', ');
  }
}

function applyAccessibilityLabels() {
  queryAll('button', '[role="button"]', '[data-pouch]', '.pouch').forEach((element) => {
    if (!element.getAttribute('aria-label')) {
      const pouchType = inferPouchType(element);

      if (pouchType) {
        element.setAttribute('aria-label', t(`aria.pouch.${pouchType}`));
      } else {
        const label = (element.textContent || '').trim();
        if (label) {
          element.setAttribute('aria-label', label);
        }
      }
    }

    if (element.matches('[role="button"]') && !element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
    }
  });

  let liveRegion = document.getElementById('token-live-region');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'token-live-region';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    document.body.appendChild(liveRegion);
  }
}

function bindButtons(selectors, handler) {
  const elements = queryAll(...selectors);

  elements.forEach((element) => {
    if (element.dataset.boundAppButton === 'true') {
      return;
    }

    element.dataset.boundAppButton = 'true';

    element.addEventListener('click', handler);

    if (!isNativeKeyboardButton(element)) {
      element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handler(event);
        }
      });
    }
  });
}

function dispatchAction(action, payload) {
  if (!gameState || typeof gameState.dispatch !== 'function') {
    return;
  }

  try {
    gameState.dispatch(action, payload);
    return;
  } catch {
    // Try object-style dispatch fallback.
  }

  try {
    gameState.dispatch({ type: action, payload });
  } catch {
    // Ignore unsupported dispatch signatures.
  }
}

function readState() {
  if (!gameState) {
    return {};
  }

  if (typeof gameState.getState === 'function') {
    try {
      return gameState.getState();
    } catch {
      return {};
    }
  }

  return gameState;
}

function inferPouchType(element) {
  if (!element) {
    return null;
  }

  if (element.dataset?.pouch) {
    return element.dataset.pouch;
  }

  const source = `${element.id || ''} ${element.className || ''}`.toLowerCase();

  if (source.includes('red')) {
    return 'red';
  }

  if (source.includes('blue')) {
    return 'blue';
  }

  if (source.includes('green')) {
    return 'green';
  }

  return null;
}

function getRatingValue(star, fallback) {
  const raw = star.dataset.ratingValue || star.dataset.value || star.dataset.rating || star.getAttribute('value');
  const parsed = Number(raw);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function normalizeToken(token) {
  if (!token || typeof token !== 'object') {
    return null;
  }

  return {
    id: token.id || '',
    label: token.label || '',
    emoji: token.emoji || ''
  };
}

function generateIdSafe() {
  if (typeof generateId === 'function') {
    try {
      return generateId();
    } catch {
      return `session-${Date.now()}`;
    }
  }

  return `session-${Date.now()}`;
}

function formatDateSafe(value) {
  if (typeof formatDate === 'function') {
    try {
      return formatDate(value);
    } catch {
      return value || '';
    }
  }

  return value || '';
}

function announce(message) {
  const liveRegion = document.getElementById('token-live-region');
  if (liveRegion) {
    liveRegion.textContent = message;
  }
}

function queryFirst(...selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }

  return null;
}

function queryAll(...selectors) {
  const merged = new Set();

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => merged.add(element));
  });

  return Array.from(merged);
}

function isNativeKeyboardButton(element) {
  if (!element || !element.tagName) {
    return false;
  }

  const tag = element.tagName.toUpperCase();
  if (tag === 'BUTTON') {
    return true;
  }

  if (tag === 'INPUT') {
    const type = (element.getAttribute('type') || '').toLowerCase();
    return type === 'button' || type === 'submit' || type === 'reset';
  }

  return false;
}
