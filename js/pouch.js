import { getRandomToken } from './tokens.js';
import { t, getLocale } from './i18n.js';

const SHAKE_MS = 500;
const RISE_MS = 800;
const FLIP_MS = 320;
let localAnimating = false;

export function initPouch(gameState) {
  const liveRegion = ensureLiveRegion();

  // Bind the 3 board pouches
  ['red', 'blue', 'green'].forEach(pouchType => {
    const pouchEl = document.getElementById(`step-pouch-${pouchType}`);
    if (pouchEl) {
      bindPouchInteraction(pouchEl, pouchType, gameState, liveRegion);
    }
  });

  // Bind per-pouch confirm & redraw buttons
  bindBoardConfirmButtons(gameState);
  bindBoardRedrawButtons(gameState, liveRegion);
}

function bindPouchInteraction(pouchEl, pouchType, gameState, liveRegion) {
  if (!pouchEl || pouchEl.dataset.boundPouch === 'true') {
    return;
  }

  pouchEl.dataset.boundPouch = 'true';
  pouchEl.dataset.pouch = pouchType;
  pouchEl.setAttribute('role', 'button');
  pouchEl.setAttribute('tabindex', '0');
  pouchEl.setAttribute('aria-label', t(`aria.pouch.open.${pouchType}`));

  let isPressed = false;

  pouchEl.addEventListener('pointerdown', (event) => {
    if (!canDraw(pouchType, gameState)) {
      return;
    }

    isPressed = true;
    pouchEl.classList.add('is-pressed');

    if (typeof pouchEl.setPointerCapture === 'function' && event.pointerId != null) {
      try {
        pouchEl.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture failures.
      }
    }
  });

  pouchEl.addEventListener('pointercancel', () => {
    isPressed = false;
    pouchEl.classList.remove('is-pressed');
  });

  pouchEl.addEventListener('pointerup', async (event) => {
    pouchEl.classList.remove('is-pressed');

    if (!isPressed) {
      return;
    }

    isPressed = false;

    if (!containsTarget(pouchEl, event.target)) {
      return;
    }

    if (!canDraw(pouchType, gameState)) {
      return;
    }

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    await runDrawSequence({ gameState, pouchEl, pouchType, liveRegion });
  });

  pouchEl.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();

    if (!canDraw(pouchType, gameState)) {
      return;
    }

    await runDrawSequence({ gameState, pouchEl, pouchType, liveRegion });
  });
}

function bindBoardConfirmButtons(gameState) {
  const buttons = document.querySelectorAll('[data-action="confirm-pouch"]');

  buttons.forEach(button => {
    if (button.dataset.boundPouchConfirm === 'true') return;
    button.dataset.boundPouchConfirm = 'true';

    button.addEventListener('click', (event) => {
      event.preventDefault();
      dispatchAction(gameState, 'CONFIRM_TOKEN');
    });
  });
}

function bindBoardRedrawButtons(gameState, liveRegion) {
  const buttons = document.querySelectorAll('[data-action="redraw-pouch"]');

  buttons.forEach(button => {
    if (button.dataset.boundPouchRedraw === 'true') return;
    button.dataset.boundPouchRedraw = 'true';

    button.addEventListener('click', async (event) => {
      event.preventDefault();

      const pouchType = button.dataset.pouch;
      if (!pouchType) return;

      const state = readState(gameState);
      if (state?.currentPouch !== pouchType) return;

      const redrawCount = Number(state?.redraws?.[pouchType] || 0);
      if (redrawCount >= 1) {
        if (liveRegion) {
          liveRegion.textContent = t('announce.redraw.used', { lore: t(`pouch.${pouchType}.lore`) });
        }
        return;
      }

      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');

      const pouchEl = document.getElementById(`step-pouch-${pouchType}`);
      const excludeId = state?.drawnTokens?.[pouchType]?.id ?? state?.lastDrawn?.[pouchType]?.id ?? null;

      await runDrawSequence({ gameState, pouchEl, pouchType, liveRegion, excludeId, isRedraw: true });
    });
  });
}

async function runDrawSequence({ gameState, pouchEl, pouchType, liveRegion, excludeId = null, isRedraw = false }) {
  if (localAnimating) {
    return;
  }

  const state = readState(gameState);
  if (state?.isAnimating) {
    return;
  }

  localAnimating = true;
  setAnimating(gameState, true);

  try {
    await animateClass(pouchEl, 'pouch--shaking', getDuration(SHAKE_MS));

    const fallbackExclude = state?.lastDrawn?.[pouchType]?.id ?? null;
    const token = getRandomToken(pouchType, excludeId ?? fallbackExclude);

    const tokenSlot = document.getElementById(`step-token-${pouchType}`);
    await animateClass(tokenSlot, 'token-rise', getDuration(RISE_MS));
    await animateClass(tokenSlot, 'token-flip', getDuration(FLIP_MS));

    revealToken(pouchType, token, liveRegion);
    if (isRedraw) {
      dispatchAction(gameState, 'REDRAW_TOKEN', { pouch: pouchType, token });
    } else {
      dispatchAction(gameState, 'DRAW_TOKEN', { pouch: pouchType, token });
    }
  } finally {
    setAnimating(gameState, false);
    localAnimating = false;
  }
}

function canDraw(pouchType, gameState) {
  if (localAnimating) {
    return false;
  }

  const state = readState(gameState);
  if (!state) {
    return true;
  }

  if (state.isAnimating) {
    return false;
  }

  // Lock pouch after first draw (prevent infinite re-draws)
  if (state.drawnTokens[pouchType]) {
    const pouchEl = document.getElementById(`step-pouch-${pouchType}`);
    if (pouchEl && !pouchEl.classList.contains('pouch--disabled')) {
      pouchEl.classList.add('pouch--disabled');
    }
    return false;
  }

  // Only allow drawing from the current active pouch
  return state.currentPouch === pouchType;
}

function setAnimating(gameState, isAnimating) {
  dispatchAction(gameState, 'SET_ANIMATING', isAnimating);
}

function revealToken(pouchType, token, liveRegion) {
  if (!token) {
    return;
  }

  const displayLabel = (getLocale() === 'en' && token.labelEn) ? token.labelEn : (token.label || '');
  const lore = t(`pouch.${pouchType}.lore`);

  const slot = document.getElementById(`step-token-${pouchType}`);
  if (slot) {
    slot.textContent = '';

    const emoji = document.createElement('span');
    emoji.className = 'token-emoji';
    emoji.textContent = token.emoji || '\u2726';
    slot.appendChild(emoji);

    const label = document.createElement('span');
    label.className = 'token-label';
    label.textContent = displayLabel;

    slot.appendChild(label);
    slot.classList.add('is-revealed');
    slot.setAttribute('aria-label', t('aria.token.fragment', { lore, label: displayLabel }));
  }

  if (liveRegion) {
    liveRegion.textContent = t('announce.token.found', { lore, label: displayLabel, emoji: token.emoji ?? '' });
  }
}

function containsTarget(parent, target) {
  return Boolean(parent && target && parent.contains(target));
}

function ensureLiveRegion() {
  let liveRegion = document.getElementById('token-live-region');

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'token-live-region';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(liveRegion);
  }

  return liveRegion;
}

function animateClass(element, className, durationMs) {
  if (!element || durationMs <= 0) {
    return wait(durationMs);
  }

  element.classList.remove(className);
  element.style.willChange = 'transform, opacity';

  void element.offsetWidth;
  element.classList.add(className);

  return wait(durationMs).then(() => {
    element.classList.remove(className);
    element.style.willChange = '';
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

function getDuration(ms) {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 0;
  }

  return ms;
}

function readState(gameState) {
  if (!gameState) {
    return null;
  }

  if (typeof gameState.getState === 'function') {
    try {
      return gameState.getState();
    } catch {
      return null;
    }
  }

  return gameState;
}

function dispatchAction(gameState, action, payload) {
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
