import { getRandomToken } from './tokens';
import { getDailyToken } from './daily';
import { t, getLocale } from './i18n';
import type { GameStateInstance, GameStateSnapshot, PouchColor, Token } from './types';

const SHAKE_MS = 350;
const RISE_MS = 450;
const FLIP_MS = 200;
let localAnimating = false;

export function initPouch(gameState: GameStateInstance): void {
  const liveRegion = ensureLiveRegion();

  // Bind the 3 board pouches and their main buttons
  (['red', 'blue', 'green'] as PouchColor[]).forEach(pouchType => {
    const pouchEl = document.getElementById(`step-pouch-${pouchType}`);
    if (pouchEl) {
      bindPouchInteraction(pouchEl as HTMLElement, pouchType, gameState, liveRegion);
    }

    const mainBtn = document.getElementById(`btn-action-${pouchType}`);
    if (mainBtn) {
      mainBtn.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLElement;
        if (btn.dataset.action === 'main-pouch-btn') {
          const pEl = document.getElementById(`step-pouch-${pouchType}`);
          if (canDraw(pouchType, gameState)) {
            await runDrawSequence({ gameState, pouchEl: pEl, pouchType, liveRegion });
          }
        } else if (btn.dataset.action === 'confirm-pouch') {
          dispatchAction(gameState, 'CONFIRM_TOKEN');
        }
      });
    }
  });

  // Bind redraw buttons
  bindBoardRedrawButtons(gameState, liveRegion);
}

function bindPouchInteraction(pouchEl: HTMLElement, pouchType: PouchColor, gameState: GameStateInstance, liveRegion: HTMLElement): void {
  if (!pouchEl || (pouchEl as HTMLElement & { dataset: DOMStringMap }).dataset.boundPouch === 'true') {
    return;
  }

  pouchEl.dataset.boundPouch = 'true';
  pouchEl.dataset.pouch = pouchType;
  pouchEl.setAttribute('role', 'button');
  pouchEl.setAttribute('tabindex', '0');
  pouchEl.setAttribute('aria-label', t(`aria.pouch.open.${pouchType}`));

  let isPressed = false;

  pouchEl.addEventListener('pointerdown', (event: PointerEvent) => {
    if (!canDraw(pouchType, gameState)) {
      return;
    }

    isPressed = true;
    pouchEl.classList.add('is-pressed');

    if (typeof pouchEl.setPointerCapture === 'function' && event.pointerId != null) {
      try {
        pouchEl.setPointerCapture(event.pointerId);
      } catch {
        // Ignore
      }
    }
  });

  pouchEl.addEventListener('pointercancel', () => {
    isPressed = false;
    pouchEl.classList.remove('is-pressed');
  });

  pouchEl.addEventListener('pointerup', async (event: PointerEvent) => {
    pouchEl.classList.remove('is-pressed');
    if (!isPressed) return;
    isPressed = false;

    if (!containsTarget(pouchEl, event.target as Node | null)) return;
    if (!canDraw(pouchType, gameState)) return;

    if (navigator.vibrate) navigator.vibrate(10);
    await runDrawSequence({ gameState, pouchEl, pouchType, liveRegion });
  });

  pouchEl.addEventListener('keydown', async (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!canDraw(pouchType, gameState)) return;
    await runDrawSequence({ gameState, pouchEl, pouchType, liveRegion });
  });
}

function bindBoardRedrawButtons(gameState: GameStateInstance, liveRegion: HTMLElement): void {
  const buttons = document.querySelectorAll<HTMLElement>('[data-action="redraw-pouch"]');

  buttons.forEach(button => {
    if (button.dataset.boundPouchRedraw === 'true') return;
    button.dataset.boundPouchRedraw = 'true';

    button.addEventListener('click', async (event: Event) => {
      event.preventDefault();

      const pouchType = button.dataset.pouch as PouchColor | undefined;
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

      (button as HTMLButtonElement).disabled = true;
      button.setAttribute('aria-disabled', 'true');

      const pEl = document.getElementById(`step-pouch-${pouchType}`);
      const excludeId = state?.drawnTokens?.[pouchType]?.id ?? state?.lastDrawn?.[pouchType]?.id ?? null;

      await runDrawSequence({ gameState, pouchEl: pEl as HTMLElement | null, pouchType, liveRegion, excludeId, isRedraw: true });
    });
  });
}

interface DrawSequenceOptions {
  gameState: GameStateInstance;
  pouchEl: HTMLElement | null;
  pouchType: PouchColor;
  liveRegion: HTMLElement;
  excludeId?: string | null;
  isRedraw?: boolean;
}

async function runDrawSequence({ gameState, pouchEl, pouchType, liveRegion, excludeId = null, isRedraw = false }: DrawSequenceOptions): Promise<void> {
  if (localAnimating) return;

  const state = readState(gameState);
  if (state?.isAnimating) return;

  localAnimating = true;
  setAnimating(gameState, true);

  try {
    await animateClass(pouchEl, 'pouch--shaking', getDuration(SHAKE_MS));

    const mode = state?.gameMode === 'free' ? 'free' : 'daily';
    const token: Token | null = mode === 'free'
      ? getRandomToken(pouchType, excludeId)
      : getDailyToken(pouchType);

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

function canDraw(pouchType: PouchColor, gameState: GameStateInstance): boolean {
  if (localAnimating) return false;
  const state = readState(gameState);
  if (!state) return true;
  if (state.isAnimating) return false;

  if (state.drawnTokens[pouchType]) {
    const pouchEl = document.getElementById(`step-pouch-${pouchType}`);
    if (pouchEl && !pouchEl.classList.contains('pouch--disabled')) {
      pouchEl.classList.add('pouch--disabled');
    }
    return false;
  }

  return state.currentPouch === pouchType;
}

function setAnimating(gameState: GameStateInstance, isAnimating: boolean): void {
  dispatchAction(gameState, 'SET_ANIMATING', isAnimating);
}

function revealToken(pouchType: PouchColor, token: Token | null, liveRegion: HTMLElement): void {
  if (!token) return;

  const displayLabel = (getLocale() === 'en' && token.labelEn) ? token.labelEn : (token.label || '');
  const lore = t(`pouch.${pouchType}.lore`);

  const slot = document.getElementById(`step-token-${pouchType}`);
  if (slot) {
    slot.textContent = '';

    const emoji = document.createElement('span');
    emoji.className = 'token-emoji';
    emoji.textContent = token.emoji || '\u2726';
    emoji.setAttribute('role', 'img');
    emoji.setAttribute('aria-label', displayLabel);
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

function containsTarget(parent: Node, target: Node | null): boolean {
  return Boolean(parent && target && parent.contains(target));
}

function ensureLiveRegion(): HTMLElement {
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

function animateClass(element: HTMLElement | null, className: string, durationMs: number): Promise<void> {
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

function getDuration(ms: number): number {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 0;
  }

  return ms;
}

function readState(gameState: GameStateInstance): GameStateSnapshot | null {
  if (!gameState) return null;
  if (typeof gameState.getState === 'function') {
    try {
      return gameState.getState();
    } catch {
      return null;
    }
  }
  return gameState as unknown as GameStateSnapshot;
}

function dispatchAction(gameState: GameStateInstance, action: string, payload?: unknown): void {
  if (!gameState || typeof gameState.dispatch !== 'function') return;
  try {
    gameState.dispatch(action, payload);
  } catch {
    //
  }
}
