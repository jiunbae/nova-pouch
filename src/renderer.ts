/* ============================================================
   renderer.ts — Hybrid Step/Flow Rendering
   Draw steps: absolute-positioned page transitions
   Post-draw (review+writing+complete): continuous scrollable flow
   ============================================================ */

import { PHASES } from './state';
import {
  TOKEN_REGISTRY,
  formatCombo,
} from './tokens';
import { formatDate } from './utils';
import { t, getLocale } from './i18n';
import type { GameStateInstance, GameStateSnapshot, HistoryData, PouchColor, Token } from './types';

/* ----------------------------------------------------------
   Constants
   ---------------------------------------------------------- */

const POUCH_ORDER: PouchColor[] = ['red', 'blue', 'green'];

// Draw steps only — post-draw sections live inside #post-draw-flow
const DRAW_STEP_IDS = [
  'step-draw-red',
  'step-draw-blue',
  'step-draw-green',
] as const;

// Flow section IDs inside post-draw-flow
const FLOW_SECTION_IDS = [
  'step-review',
  'step-complete',
] as const;

/* ----------------------------------------------------------
   DOM Element Cache
   ---------------------------------------------------------- */
interface DOMCache {
  layers: Record<string, HTMLElement | null>;
  drawSteps: Record<string, HTMLElement | null>;
  postDrawFlow: HTMLElement | null;
  flowSections: Record<string, HTMLElement | null>;
  steps: Record<string, HTMLElement | null>;
  progressDots: NodeListOf<HTMLElement>;
  stepPouches: Record<PouchColor, HTMLElement | null>;
  stepTokenSlots: Record<PouchColor, HTMLElement | null>;
  stepActions: Record<PouchColor, HTMLElement | null>;
  collectedStack: HTMLElement | null;
  reviewTokenRed: HTMLElement | null;
  reviewTokenBlue: HTMLElement | null;
  reviewTokenGreen: HTMLElement | null;
  reviewComboText: HTMLElement | null;
  inputStory: HTMLTextAreaElement | null;
  charCount: HTMLElement | null;
  writingForm: HTMLElement | null;
  btnCTA: HTMLButtonElement | null;
  completeCombo: HTMLElement | null;
  completeStory: HTMLElement | null;
  btnRestart: HTMLButtonElement | null;
  starRating: HTMLElement | null;
  historyList: HTMLElement | null;
  statsTotal: HTMLElement | null;
}

const dom: DOMCache = {} as DOMCache;

function cacheDOM(): void {
  // Layers
  dom.layers = {
    idle:    document.getElementById('layer-idle'),
    game:    document.getElementById('layer-game'),
    history: document.getElementById('layer-history'),
  };

  // Draw steps (absolute-positioned)
  dom.drawSteps = {};
  DRAW_STEP_IDS.forEach(id => {
    dom.drawSteps[id] = document.getElementById(id);
  });

  // Post-draw flow container
  dom.postDrawFlow = document.getElementById('post-draw-flow');

  // Flow sections
  dom.flowSections = {};
  FLOW_SECTION_IDS.forEach(id => {
    dom.flowSections[id] = document.getElementById(id);
  });

  // Legacy compat: dom.steps merges both for any code that references it
  dom.steps = { ...dom.drawSteps, ...dom.flowSections };

  // Progress dots
  dom.progressDots = document.querySelectorAll<HTMLElement>('.step-progress__dot');

  // Draw step elements
  dom.stepPouches = {} as Record<PouchColor, HTMLElement | null>;
  dom.stepTokenSlots = {} as Record<PouchColor, HTMLElement | null>;
  dom.stepActions = {} as Record<PouchColor, HTMLElement | null>;
  dom.collectedStack = document.getElementById('collected-stack');
  POUCH_ORDER.forEach(color => {
    dom.stepPouches[color] = document.getElementById(`step-pouch-${color}`);
    dom.stepTokenSlots[color] = document.getElementById(`step-token-${color}`);
    dom.stepActions[color] = document.getElementById(`step-actions-${color}`);
  });

  // Review
  dom.reviewTokenRed   = document.getElementById('review-token-red');
  dom.reviewTokenBlue  = document.getElementById('review-token-blue');
  dom.reviewTokenGreen = document.getElementById('review-token-green');
  dom.reviewComboText  = document.getElementById('review-combo-text');
  // Writing
  dom.inputStory     = document.getElementById('step-input-story') as HTMLTextAreaElement | null;
  dom.charCount      = document.getElementById('step-char-count');
  dom.writingForm    = document.getElementById('writing-form');
  dom.btnCTA         = document.getElementById('btn-start-writing') as HTMLButtonElement | null;

  // Complete
  dom.completeCombo     = document.getElementById('complete-combo');
  dom.completeStory     = document.getElementById('complete-story');
  dom.btnRestart        = document.getElementById('step-btn-restart') as HTMLButtonElement | null;
  dom.starRating        = document.getElementById('step-star-rating');

  // History
  dom.historyList    = document.getElementById('history-list');
  dom.statsTotal     = document.getElementById('stats-total');
}

/* ----------------------------------------------------------
   Step Derivation — maps state to a step ID or 'post-draw-flow'
   ---------------------------------------------------------- */

let _currentStep: string | null = null;

function deriveStep(state: GameStateSnapshot): string | null {
  const phase = state.phase === PHASES.HISTORY
    ? (state._prevPhase || PHASES.IDLE)
    : state.phase;

  switch (phase) {
    case PHASES.DRAWING:
      switch (state.currentPouch) {
        case 'red':   return 'step-draw-red';
        case 'blue':  return 'step-draw-blue';
        case 'green': return 'step-draw-green';
        default:      return 'step-draw-red';
      }
    case PHASES.REVIEW:
    case PHASES.WRITING:
    case PHASES.COMPLETE:
      return 'post-draw-flow';
    default:
      return null;
  }
}

function getProgressIndex(stepId: string | null): number {
  // 4 dots: 0=red, 1=blue, 2=green, 3=post-draw
  switch (stepId) {
    case 'step-draw-red':   return 0;
    case 'step-draw-blue':  return 1;
    case 'step-draw-green': return 2;
    case 'post-draw-flow':  return 3;
    default:                return -1;
  }
}

/* ----------------------------------------------------------
   Step Transitions
   ---------------------------------------------------------- */

function transitionToStep(newStep: string | null): void {
  if (newStep === _currentStep) return;

  // --- Aggressive Scroll Reset ---
  if (dom.postDrawFlow) dom.postDrawFlow.scrollTop = 0;
  DRAW_STEP_IDS.forEach(id => {
    const content = dom.drawSteps[id]?.querySelector('.step__content');
    if (content) content.scrollTop = 0;
  });

  const oldStep = _currentStep;
  _currentStep = newStep;

  const isDrawStep = (id: string | null): boolean => id != null && (DRAW_STEP_IDS as readonly string[]).includes(id);
  const isPostDraw = (id: string | null): boolean => id === 'post-draw-flow';

  // --- Hide old draw step ---
  if (oldStep && isDrawStep(oldStep) && dom.drawSteps[oldStep]) {
    const oldEl = dom.drawSteps[oldStep]!;
    oldEl.classList.remove('step--active');
    oldEl.style.display = 'none';
  }

  // --- Hide post-draw flow if going back to draw steps ---
  if (oldStep && isPostDraw(oldStep) && !isPostDraw(newStep)) {
    if (dom.postDrawFlow) {
      dom.postDrawFlow.style.display = 'none';
      // Reset all flow sections
      FLOW_SECTION_IDS.forEach(id => {
        const el = dom.flowSections[id];
        if (el) {
          el.classList.remove('step--active', 'flow-section--revealed');
          el.classList.add('flow-section--collapsed');
        }
      });
      // Reset inline writing
      collapseInlineWriting(dom.writingForm);
      // Reset review writing-active class
      const reviewSection = dom.flowSections['step-review'];
      reviewSection?.classList.remove('review--writing-active');
      // Clear collected stack
      if (dom.collectedStack) {
        dom.collectedStack.innerHTML = '';
        dom.collectedStack.style.display = '';
      }
      dom.collectedStack?.parentElement?.style.setProperty('--stack-height', '0px');
      // Reset flow phase tracking
      _prevFlowPhase = null;
      // Reset textarea to editable
      if (dom.inputStory) {
        dom.inputStory.readOnly = false;
      }
      // Reset CTA button
      if (dom.btnCTA) {
        dom.btnCTA.textContent = t('review.write');
        dom.btnCTA.disabled = false;
        dom.btnCTA.style.display = '';
        dom.btnCTA.classList.remove('btn--morphing');
      }
    }
  }

  // --- Show new draw step ---
  if (newStep && isDrawStep(newStep) && dom.drawSteps[newStep]) {
    // Hide post-draw-flow if visible
    if (dom.postDrawFlow) dom.postDrawFlow.style.display = 'none';

    // Show collected stack during draw steps
    if (dom.collectedStack) {
      dom.collectedStack.style.display = '';
      dom.collectedStack.style.opacity = '1';
    }

    const newEl = dom.drawSteps[newStep]!;
    newEl.style.display = 'flex';
    requestAnimationFrame(() => {
      newEl.classList.add('step--active');
    });
  }

  // --- Show post-draw flow ---
  if (newStep && isPostDraw(newStep)) {
    // Hide all draw steps
    DRAW_STEP_IDS.forEach(id => {
      const el = dom.drawSteps[id];
      if (el) {
        el.classList.remove('step--active', 'step--exit-forward', 'step--exit-backward');
      }
    });

    // Hide collected stack — review section shows its own token cards
    if (dom.collectedStack) dom.collectedStack.style.display = 'none';

    if (dom.postDrawFlow) {
      dom.postDrawFlow.style.display = 'flex';
    }
  }

  // Update progress dots
  updateProgressDots(getProgressIndex(newStep));

  // Move focus to newly active step
  requestAnimationFrame(() => {
    let focusTarget: HTMLElement | null = null;
    if (newStep && isDrawStep(newStep) && dom.drawSteps[newStep]) {
      focusTarget = dom.drawSteps[newStep]!.querySelector('.pouch:not(.pouch--disabled), button:not([hidden]):not([disabled]), .step__instruction');
    } else if (newStep && isPostDraw(newStep) && dom.postDrawFlow) {
      focusTarget = dom.postDrawFlow.querySelector('.review__combo, button:not([hidden]):not([disabled]), h2');
    }
    if (focusTarget && typeof (focusTarget as HTMLElement).focus === 'function') {
      (focusTarget as HTMLElement).focus({ preventScroll: true });
    }
  });
}

function updateProgressDots(activeIndex: number): void {
  dom.progressDots.forEach((dot, i) => {
    dot.classList.remove('step-progress__dot--active', 'step-progress__dot--done');
    if (i === activeIndex) {
      dot.classList.add('step-progress__dot--active');
    } else if (i < activeIndex) {
      dot.classList.add('step-progress__dot--done');
    }
  });

  // Update progressbar ARIA
  const progressBar = document.querySelector('.step-progress[role="progressbar"]');
  if (progressBar && activeIndex >= 0) {
    progressBar.setAttribute('aria-valuenow', String(activeIndex + 1));
  }
}

/* ----------------------------------------------------------
   Post-Draw Flow — reveal/collapse sections
   ---------------------------------------------------------- */

let _prevFlowPhase: string | null = null;

function updatePostDrawFlow(state: GameStateSnapshot): void {
  const phase = state.phase === PHASES.HISTORY
    ? (state._prevPhase || PHASES.IDLE)
    : state.phase;

  const phaseChanged = phase !== _prevFlowPhase;
  _prevFlowPhase = phase;

  const reviewEl   = dom.flowSections['step-review'];
  const completeEl = dom.flowSections['step-complete'];
  const writingEl  = dom.writingForm;
  const btnCTA     = dom.btnCTA;

  if (phase === PHASES.REVIEW) {
    // Hide collected stack in post-draw flow
    if (dom.collectedStack) dom.collectedStack.style.opacity = '0';

    // Show review, collapse inline-writing + complete; CTA = "이 세계를 기록하기"
    revealSection(reviewEl);
    collapseInlineWriting(writingEl);
    collapseSection(completeEl);


    // Remove writing-mode classes
    reviewEl?.classList.remove('review--writing-active');

    if (btnCTA) {
      btnCTA.textContent = t('review.write');
      btnCTA.disabled = false;
      btnCTA.style.display = '';
    }

    // Reset textarea to editable
    if (dom.inputStory) {
      dom.inputStory.readOnly = false;
    }
  }

  if (phase === PHASES.WRITING) {

    revealSection(reviewEl);
    revealInlineWriting(writingEl);
    collapseSection(completeEl);

    // Hide prompt
    reviewEl?.classList.add('review--writing-active');

    // Ensure textarea is editable
    if (dom.inputStory) {
      dom.inputStory.readOnly = false;
    }

    // CTA morphs with animation (only on phase transition)
    if (btnCTA && phaseChanged) {
      btnCTA.classList.add('btn--morphing');
      btnCTA.style.display = '';
      setTimeout(() => {
        btnCTA.textContent = t('writing.complete');
        btnCTA.disabled = true; // syncWritingValidation in app.ts will enable when valid
      }, 150);
      setTimeout(() => {
        btnCTA.classList.remove('btn--morphing');
      }, 300);
    }

    // Auto-focus textarea after reveal animation (only on phase transition)
    if (dom.inputStory && phaseChanged) {
      setTimeout(() => {
        dom.inputStory?.focus();
      }, 400);
    }

    // Scroll inline-writing into view only if needed
    if (writingEl && phaseChanged) {
      setTimeout(() => {
        writingEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 400);
    }
  }

  if (phase === PHASES.COMPLETE) {

    revealSection(reviewEl);
    // Collapse inline-writing — complete__card already shows the story
    collapseInlineWriting(writingEl);
    revealSection(completeEl);

    // Keep prompt hidden
    reviewEl?.classList.add('review--writing-active');

    // Hide CTA button in complete phase
    if (btnCTA) {
      btnCTA.style.display = 'none';
    }

    // Hide restart button in daily mode
    if (dom.btnRestart) {
      if (state.gameMode === 'daily') {
        dom.btnRestart.setAttribute('hidden', '');
      } else {
        dom.btnRestart.removeAttribute('hidden');
      }
    }

    // Scroll complete into view
    if (completeEl) {
      setTimeout(() => {
        completeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }
}

function revealInlineWriting(el: HTMLElement | null): void {
  if (!el) return;
  el.removeAttribute('hidden');
}

function collapseInlineWriting(el: HTMLElement | null): void {
  if (!el) return;
  el.setAttribute('hidden', '');
}

function revealSection(el: HTMLElement | null): void {
  if (!el) return;
  el.removeAttribute('hidden');
  el.classList.remove('flow-section--collapsed');
  el.classList.add('flow-section--revealed');
  el.classList.add('step--active');
}

function collapseSection(el: HTMLElement | null): void {
  if (!el) return;
  el.setAttribute('hidden', '');
  el.classList.remove('flow-section--revealed', 'step--active');
  el.classList.add('flow-section--collapsed');
}

/* ----------------------------------------------------------
   Layer Visibility
   ---------------------------------------------------------- */

function updateVisibility(state: GameStateSnapshot): void {
  const phase = state.phase;
  const showHistory = phase === PHASES.HISTORY;

  const basePhase = showHistory ? (state._prevPhase || PHASES.IDLE) : phase;

  const showIdle = basePhase === PHASES.IDLE;
  const showGame = basePhase === PHASES.DRAWING || basePhase === PHASES.REVIEW
                || basePhase === PHASES.WRITING || basePhase === PHASES.COMPLETE;

  toggleLayer(dom.layers.idle, showIdle);
  toggleLayer(dom.layers.game, showGame);

  // History overlay
  const historyEl = dom.layers.history;
  if (historyEl) {
    if (showHistory) {
      historyEl.classList.add('layer--active');
      historyEl.style.display = 'flex';
    } else {
      historyEl.classList.remove('layer--active');
      setTimeout(() => {
        if (!historyEl.classList.contains('layer--active')) {
          historyEl.style.display = 'none';
        }
      }, 500);
    }
  }
}

function toggleLayer(el: HTMLElement | null, show: boolean): void {
  if (!el) return;
  if (show) {
    el.style.display = 'flex';
    void el.offsetWidth;
    el.classList.add('layer--active');
  } else {
    el.classList.remove('layer--active');
    setTimeout(() => {
      if (!el.classList.contains('layer--active')) {
        el.style.display = 'none';
      }
    }, 400);
  }
}

/* ----------------------------------------------------------
   Draw Step Rendering
   ---------------------------------------------------------- */

function renderDrawStep(state: GameStateSnapshot): void {
  const color = state.currentPouch;
  if (!color) return;

  const token = state.drawnTokens[color];
  const mainBtn = document.getElementById(`btn-action-${color}`) as HTMLButtonElement | null;
  const redrawBtn = document.querySelector(`[data-action="redraw-pouch"][data-pouch="${color}"]`) as HTMLElement | null;
  const pouchEl = dom.stepPouches[color];
  const slotEl = dom.stepTokenSlots[color];
  const stepId = `step-draw-${color}`;
  const stepEl = dom.drawSteps[stepId];
  const textGroup = stepEl?.querySelector('.step__text-group') as HTMLElement | null;

  if (mainBtn) {
    const btnText = mainBtn.querySelector('.btn-text');
    if (token) {
      // Token drawn -> "Next" mode (Keep Pouch Color)
      mainBtn.className = `btn btn--pouch-${color} btn--full`;
      if (btnText) btnText.textContent = t('draw.confirm');
      mainBtn.dataset.action = 'confirm-pouch';
      
      // Hide instructions when token is drawn
      if (textGroup) textGroup.setAttribute('hidden', '');
      
      // Only show redraw button in free mode
      if (redrawBtn) {
        if (state.gameMode === 'free') {
          redrawBtn.removeAttribute('hidden');
        } else {
          redrawBtn.setAttribute('hidden', '');
        }
      }
      
      // Hide pouch visual with animation
      if (pouchEl) {
        pouchEl.style.opacity = '0';
        pouchEl.style.transform = 'scale(0.8)';
        pouchEl.style.pointerEvents = 'none';
      }
    } else {
      // Initial -> "Open Pouch" mode
      mainBtn.className = `btn btn--pouch-${color} btn--full`;
      if (btnText) btnText.textContent = t(`pouch.${color}.label`);
      mainBtn.dataset.action = 'main-pouch-btn';
      if (redrawBtn) redrawBtn.setAttribute('hidden', '');

      // Show instructions initially
      if (textGroup) textGroup.removeAttribute('hidden');

      // Reset pouch visual
      if (pouchEl) {
        pouchEl.style.opacity = '1';
        pouchEl.style.transform = 'scale(1)';
        pouchEl.style.pointerEvents = 'auto';
      }
      
      // Clear slot
      if (slotEl) {
        slotEl.innerHTML = '';
        slotEl.classList.remove('is-revealed');
      }
    }

    // Handle redraw limit
    if (redrawBtn) {
      const redrawCount = state.redraws[color] || 0;
      (redrawBtn as HTMLButtonElement).disabled = redrawCount >= 1;
    }
  }

  // Update shared collected stack
  updateCollectedStack(state);
}

function updateCollectedStack(state: GameStateSnapshot): void {
  const stackEl = dom.collectedStack;
  if (!stackEl) return;

  const colors: PouchColor[] = ['red', 'blue', 'green'];
  const currentIndex = state.currentPouch
    ? colors.indexOf(state.currentPouch)
    : -1;

  // Add chips for confirmed pouches BEFORE the current one
  colors.forEach((color, index) => {
    const token = state.drawnTokens[color];
    const chipId = `stack-chip-${color}`;
    const existing = stackEl.querySelector(`#${chipId}`);

    if (index < currentIndex && token && !existing) {
      const chip = createChip(color, token);
      chip.id = chipId;
      stackEl.appendChild(chip);
    }
  });

  // Update --stack-height for step content padding
  requestAnimationFrame(() => {
    const h = stackEl.offsetHeight || 0;
    stackEl.parentElement?.style.setProperty('--stack-height', `${h}px`);
  });
}

function createChip(color: PouchColor, token: Token): HTMLElement {
  const chip = document.createElement('div');
  chip.className = `collected-chip collected-chip--${color}`;

  const emoji = document.createElement('span');
  emoji.className = 'collected-chip__emoji';
  emoji.textContent = token.emoji || '';
  emoji.setAttribute('role', 'img');
  emoji.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'collected-chip__label';
  label.textContent = (getLocale() === 'en' && token.labelEn) ? token.labelEn : (token.label || '');

  chip.append(emoji, label);
  return chip;
}

/* ----------------------------------------------------------
   Render Functions per Step
   ---------------------------------------------------------- */

function renderReview(state: GameStateSnapshot): void {
  const tokens = state.drawnTokens;

  fillTokenCard(dom.reviewTokenRed, tokens.red);
  fillTokenCard(dom.reviewTokenBlue, tokens.blue);
  fillTokenCard(dom.reviewTokenGreen, tokens.green);

  const combo = formatCombo(tokens);
  if (dom.reviewComboText) {
    dom.reviewComboText.textContent = `"${combo}"`;
  }
}

function fillTokenCard(cardEl: HTMLElement | null, token: Token | null): void {
  if (!token || !cardEl) return;
  const emojiEl = cardEl.querySelector('.token-card__emoji');
  const labelEl = cardEl.querySelector('.token-card__label');

  if (emojiEl) {
    emojiEl.textContent = token.emoji;
    emojiEl.setAttribute('role', 'img');
    emojiEl.setAttribute('aria-label', token.label || '');
  }

  if (labelEl) labelEl.textContent = (getLocale() === 'en' && token.labelEn) ? token.labelEn : token.label;
}

function renderWriting(state: GameStateSnapshot): void {
  if (dom.inputStory) dom.inputStory.value = state.userStory;
  if (dom.charCount) dom.charCount.textContent = String(state.userStory.length);
}

function renderComplete(state: GameStateSnapshot): void {
  if (dom.completeCombo) dom.completeCombo.textContent = formatCombo(state.drawnTokens, getLocale());
  if (dom.completeStory) dom.completeStory.textContent = state.userStory;
}

function renderStarRating(rating: number): void {
  if (!dom.starRating) return;
  const stars = dom.starRating.querySelectorAll<HTMLElement>('.star');
  stars.forEach(star => {
    const val = parseInt(star.dataset.value || '0', 10);
    if (val <= rating) {
      star.textContent = '\u2605';
      star.classList.add('active');
    } else {
      star.textContent = '\u2606';
      star.classList.remove('active');
    }
  });
}

function renderHistory(state: GameStateSnapshot, historyData: HistoryData | null): void {
  if (!historyData || !historyData.sessions || historyData.sessions.length === 0) {
    if (dom.historyList) {
      dom.historyList.textContent = '';
      const emptyP = document.createElement('p');
      emptyP.className = 'history__empty narrative-font';
      emptyP.textContent = t('history.empty');
      dom.historyList.appendChild(emptyP);
    }
    if (dom.statsTotal) dom.statsTotal.textContent = t('history.statsTotal', { count: 0 });
    return;
  }

  const sessions = historyData.sessions;
  const stats = historyData.stats || {};

  if (dom.statsTotal) dom.statsTotal.textContent = t('history.statsTotal', { count: stats.totalPlayed || sessions.length });

  const frag = document.createDocumentFragment();
  sessions.forEach((session, idx) => {
    const number = sessions.length - idx;
    const date = session.completedAt ? formatDate(session.completedAt) : '';
    const combo = formatSessionCombo(session);
    const tokens = session.tokens || {};
    const storyPreview = (session.userStory || '').slice(0, 80) + ((session.userStory || '').length > 80 ? '\u2026' : '');

    const card = document.createElement('div');
    card.className = 'history-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('click', () => {
      dispatchAction('VIEW_RECORD_DETAIL', { session });
    });

    const header = document.createElement('div');
    header.className = 'history-card__header';
    const numSpan = document.createElement('span');
    numSpan.className = 'history-card__number';
    numSpan.textContent = `#${number}`;
    const dateSpan = document.createElement('span');
    dateSpan.className = 'history-card__date';
    dateSpan.textContent = date;
    header.append(numSpan, dateSpan);

    const tokensDiv = document.createElement('div');
    tokensDiv.className = 'history-card__tokens';
    (['red', 'blue', 'green'] as const).forEach(color => {
      const span = document.createElement('span');
      span.className = `collected-chip collected-chip--${color}`;
      span.textContent = `${tokens[color]?.emoji || ''} ${tokens[color]?.label || ''}`.trim();
      tokensDiv.appendChild(span);
    });

    const comboP = document.createElement('p');
    comboP.className = 'history-card__combo';
    comboP.textContent = `\u201C${combo}\u201D`;

    card.append(header, tokensDiv, comboP);

    if (storyPreview) {
      const storyP = document.createElement('p');
      storyP.className = 'history-card__story';
      storyP.textContent = storyPreview;
      card.appendChild(storyP);
    }

    frag.appendChild(card);
  });

  if (dom.historyList) {
    dom.historyList.textContent = '';
    dom.historyList.appendChild(frag);
  }
}

/**
 * Build locale-aware combo text for a history session.
 */
function formatSessionCombo(session: { tokens?: Record<string, Token | null> | null }): string {
  const tokens = session?.tokens;
  if (!tokens) return '';

  if (getLocale() === 'en') {
    const blue = lookupLabelEn(tokens.blue) || tokens.blue?.label || '';
    const green = lookupLabelEn(tokens.green) || tokens.green?.label || '';
    const red = lookupLabelEn(tokens.red) || tokens.red?.label || '';
    return `${blue}, ${green} ${red}`;
  }

  // Korean: green blue red (no comma)
  return `${tokens.green?.label || ''} ${tokens.blue?.label || ''} ${tokens.red?.label || ''}`;
}

function lookupLabelEn(token: Token | null | undefined): string {
  if (!token?.id) return '';
  if (token.labelEn) return token.labelEn;
  const color = token.id.split('-')[0] as PouchColor;
  const pouch = TOKEN_REGISTRY.pouches[color];
  if (!pouch) return '';
  const found = pouch.tokens.find(t => t.id === token.id);
  return found?.labelEn || '';
}

/* ----------------------------------------------------------
   Main Render — called on every state change
   ---------------------------------------------------------- */

let _lastState: GameStateSnapshot | null = null;

function renderCurrentStep(state: GameStateSnapshot, historyData: HistoryData | null = null): void {
  const basePhase = state.phase === PHASES.HISTORY
    ? (state._prevPhase || PHASES.IDLE)
    : state.phase;

  switch (basePhase) {
    case PHASES.DRAWING:
      renderDrawStep(state);
      break;

    case PHASES.REVIEW:
      renderReview(state);
      updatePostDrawFlow(state);
      break;

    case PHASES.WRITING:
      renderReview(state);
      renderWriting(state);
      updatePostDrawFlow(state);
      break;

    case PHASES.COMPLETE:
      renderReview(state);
      renderComplete(state);
      updatePostDrawFlow(state);
      break;
  }

  if (state.phase === PHASES.HISTORY) {
    renderHistory(state, historyData);
  }
}

function render(state: GameStateSnapshot, action: string, payload: unknown, historyData: HistoryData | null = null): void {
  _lastState = state;

  // Clear auto-write timer on RETRY/RESTART/GO_BACK
  if (action === 'RETRY' || action === 'RESTART' || action === 'GO_BACK' || action === 'INIT') {

    // Clear collected stack visually
    if (dom.collectedStack) {
      dom.collectedStack.innerHTML = '';
      dom.collectedStack.style.opacity = '1';
      dom.collectedStack.style.display = '';
    }
  }

  // 1. Update layer visibility
  updateVisibility(state);

  // 2. Derive current step and transition
  const newStep = deriveStep(state);
  transitionToStep(newStep);

  // --- Reset scroll position on transitions ---
  if (dom.postDrawFlow) dom.postDrawFlow.scrollTop = 0;
  DRAW_STEP_IDS.forEach(id => {
    const content = dom.drawSteps[id]?.querySelector('.step__content');
    if (content) content.scrollTop = 0;
  });

  // 3. Render step content + history overlay
  renderCurrentStep(state, historyData);
}

/* ----------------------------------------------------------
   Public API
   ---------------------------------------------------------- */

let _historyLoader: (() => HistoryData) | null = null;

/**
 * Initialize the renderer. Call once after DOM is ready.
 */
export function initRenderer(stateInstance: GameStateInstance, historyLoader: (() => HistoryData) | null = null): void {
  cacheDOM();
  _historyLoader = historyLoader;

  // Set initial display states
  if (dom.layers.history) {
    dom.layers.history.style.display = 'none';
  }
  if (dom.layers.game) {
    dom.layers.game.style.display = 'none';
  }
  if (dom.postDrawFlow) {
    dom.postDrawFlow.style.display = 'none';
  }

  stateInstance.subscribe((state, action, payload) => {
    const historyData = (state.phase === PHASES.HISTORY && _historyLoader)
      ? _historyLoader()
      : null;
    render(state, action, payload as string, historyData);
  });

  // Initial render
  const initialState = stateInstance.getState();
  render(initialState, 'INIT', null);
}

/**
 * Re-render current step using cached state. Call after locale switch.
 */
export function refreshLocale(): void {
  if (_lastState) {
    const historyData = (_lastState.phase === PHASES.HISTORY && _historyLoader)
      ? _historyLoader()
      : null;
    renderCurrentStep(_lastState, historyData);
  }
}

/**
 * Expose for use by pouch.ts animation and app.ts.
 */
export { renderStarRating };
