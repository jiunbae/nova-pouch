/* ============================================================
   renderer.js — Hybrid Step/Flow Rendering
   Draw steps: absolute-positioned page transitions
   Post-draw (review+writing+complete): continuous scrollable flow
   ============================================================ */

import { PHASES } from './state.js';
import {
  TOKEN_REGISTRY,
  formatCombo,
} from './tokens.js';
import { formatDate } from './utils.js';
import { t, getLocale } from './i18n.js';

/* ----------------------------------------------------------
   Constants
   ---------------------------------------------------------- */

const POUCH_ORDER = ['red', 'blue', 'green'];

// Draw steps only — post-draw sections live inside #post-draw-flow
const DRAW_STEP_IDS = [
  'step-draw-red',
  'step-draw-blue',
  'step-draw-green',
];

// Flow section IDs inside post-draw-flow
const FLOW_SECTION_IDS = [
  'step-review',
  'step-writing',
  'step-complete',
];

/* ----------------------------------------------------------
   DOM Element Cache
   ---------------------------------------------------------- */
const dom = {};

function cacheDOM() {
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
  dom.progressDots = document.querySelectorAll('.step-progress__dot');

  // Draw step elements
  dom.stepPouches = {};
  dom.stepTokenSlots = {};
  dom.stepActions = {};
  dom.stepCollected = {};
  POUCH_ORDER.forEach(color => {
    dom.stepPouches[color] = document.getElementById(`step-pouch-${color}`);
    dom.stepTokenSlots[color] = document.getElementById(`step-token-${color}`);
    dom.stepActions[color] = document.getElementById(`step-actions-${color}`);
    dom.stepCollected[color] = document.getElementById(`step-collected-${color}`);
  });

  // Review
  dom.reviewTokenRed   = document.getElementById('review-token-red');
  dom.reviewTokenBlue  = document.getElementById('review-token-blue');
  dom.reviewTokenGreen = document.getElementById('review-token-green');
  dom.reviewComboText  = document.getElementById('review-combo-text');
  // Writing
  dom.inputStory     = document.getElementById('step-input-story');
  dom.charCount      = document.getElementById('step-char-count');
  dom.btnComplete    = document.getElementById('step-btn-complete');

  // Complete
  dom.completeCombo     = document.getElementById('complete-combo');
  dom.completeStory     = document.getElementById('complete-story');
  dom.starRating        = document.getElementById('step-star-rating');

  // History
  dom.historyList    = document.getElementById('history-list');
  dom.statsTotal     = document.getElementById('stats-total');
  dom.statsAvgRating = document.getElementById('stats-avg-rating');
}

/* ----------------------------------------------------------
   Step Derivation — maps state to a step ID or 'post-draw-flow'
   ---------------------------------------------------------- */

let _currentStep = null;

function deriveStep(state) {
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

function getProgressIndex(stepId) {
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

function transitionToStep(newStep) {
  if (newStep === _currentStep) return;

  const oldStep = _currentStep;
  _currentStep = newStep;

  const isDrawStep = (id) => DRAW_STEP_IDS.includes(id);
  const isPostDraw = (id) => id === 'post-draw-flow';

  // --- Hide old draw step ---
  if (oldStep && isDrawStep(oldStep) && dom.drawSteps[oldStep]) {
    const oldEl = dom.drawSteps[oldStep];
    oldEl.classList.remove('step--active');

    // Accordion collapse when transitioning between draw steps
    if (isDrawStep(newStep)) {
      oldEl.classList.add('step--collapsing');
      setTimeout(() => {
        oldEl.classList.remove('step--collapsing');
      }, 350);
    } else {
      const isForward = true;
      oldEl.classList.add(isForward ? 'step--exit-forward' : 'step--exit-backward');
      setTimeout(() => {
        oldEl.classList.remove('step--exit-forward', 'step--exit-backward');
      }, 350);
    }
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
    }
  }

  // --- Show new draw step ---
  if (newStep && isDrawStep(newStep) && dom.drawSteps[newStep]) {
    // Hide post-draw-flow if visible
    if (dom.postDrawFlow) dom.postDrawFlow.style.display = 'none';

    const newEl = dom.drawSteps[newStep];
    newEl.classList.remove('step--exit-forward', 'step--exit-backward');
    void newEl.offsetWidth;
    newEl.classList.add('step--active');
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

    if (dom.postDrawFlow) {
      dom.postDrawFlow.style.display = 'flex';
    }
  }

  // Update progress dots
  updateProgressDots(getProgressIndex(newStep));
}

function updateProgressDots(activeIndex) {
  dom.progressDots.forEach((dot, i) => {
    dot.classList.remove('step-progress__dot--active', 'step-progress__dot--done');
    if (i === activeIndex) {
      dot.classList.add('step-progress__dot--active');
    } else if (i < activeIndex) {
      dot.classList.add('step-progress__dot--done');
    }
  });
}

/* ----------------------------------------------------------
   Post-Draw Flow — reveal/collapse sections
   ---------------------------------------------------------- */

let _autoWriteTimer = null;
let _stateDispatcher = null;

function clearAutoWriteTimer() {
  if (_autoWriteTimer) {
    clearTimeout(_autoWriteTimer);
    _autoWriteTimer = null;
  }
}

function updatePostDrawFlow(state) {
  const phase = state.phase === PHASES.HISTORY
    ? (state._prevPhase || PHASES.IDLE)
    : state.phase;

  const reviewEl  = dom.flowSections['step-review'];
  const writingEl = dom.flowSections['step-writing'];
  const completeEl = dom.flowSections['step-complete'];

  if (phase === PHASES.REVIEW) {
    // Show review, collapse writing + complete
    revealSection(reviewEl);
    collapseSection(writingEl);
    collapseSection(completeEl);

    // Auto-transition to WRITING after 1.2s
    clearAutoWriteTimer();
    _autoWriteTimer = setTimeout(() => {
      if (_stateDispatcher) {
        _stateDispatcher.dispatch('START_WRITING');
      }
    }, 1200);
  }

  if (phase === PHASES.WRITING) {
    clearAutoWriteTimer();
    revealSection(reviewEl);
    revealSection(writingEl);
    collapseSection(completeEl);

    // Scroll writing into view
    if (writingEl) {
      setTimeout(() => {
        writingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  if (phase === PHASES.COMPLETE) {
    clearAutoWriteTimer();
    revealSection(reviewEl);
    revealSection(writingEl);
    revealSection(completeEl);

    // Scroll complete into view
    if (completeEl) {
      setTimeout(() => {
        completeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }
}

function revealSection(el) {
  if (!el) return;
  el.classList.remove('flow-section--collapsed');
  el.classList.add('flow-section--revealed');
  el.classList.add('step--active');
}

function collapseSection(el) {
  if (!el) return;
  el.classList.remove('flow-section--revealed', 'step--active');
  el.classList.add('flow-section--collapsed');
}

/* ----------------------------------------------------------
   Layer Visibility
   ---------------------------------------------------------- */

function updateVisibility(state) {
  const phase = state.phase;
  const showHistory = phase === PHASES.HISTORY;

  const basePhase = showHistory ? (state._prevPhase || PHASES.IDLE) : phase;

  const showIdle = basePhase === PHASES.IDLE;
  const showGame = basePhase === PHASES.DRAWING || basePhase === PHASES.REVIEW
                || basePhase === PHASES.WRITING || basePhase === PHASES.COMPLETE;

  toggleLayer(dom.layers.idle, showIdle);
  toggleLayer(dom.layers.game, showGame);

  // History overlay
  if (showHistory) {
    dom.layers.history.classList.add('layer--active');
    dom.layers.history.style.display = 'flex';
  } else {
    dom.layers.history.classList.remove('layer--active');
    setTimeout(() => {
      if (!dom.layers.history.classList.contains('layer--active')) {
        dom.layers.history.style.display = 'none';
      }
    }, 500);
  }
}

function toggleLayer(el, show) {
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
    }, 350);
  }
}

/* ----------------------------------------------------------
   Draw Step Rendering
   ---------------------------------------------------------- */

function renderDrawStep(state) {
  const color = state.currentPouch;
  if (!color) return;

  const token = state.drawnTokens[color];
  const actionsEl = dom.stepActions[color];

  // Reset slot and pouch when navigating back (no token drawn)
  if (!token) {
    const slotEl = dom.stepTokenSlots[color];
    if (slotEl) {
      slotEl.innerHTML = '';
      slotEl.classList.remove('is-revealed');
    }
    const pouchEl = dom.stepPouches[color];
    if (pouchEl) {
      pouchEl.classList.remove('pouch--disabled');
    }
  }

  // Show/hide actions based on whether a token has been drawn
  if (actionsEl) {
    if (token) {
      actionsEl.removeAttribute('hidden');
    } else {
      actionsEl.setAttribute('hidden', '');
    }
  }

  // Update redraw button
  if (actionsEl) {
    const redrawBtn = actionsEl.querySelector('[data-action="redraw-pouch"]');
    if (redrawBtn) {
      const redrawCount = state.redraws[color] || 0;
      if (redrawCount >= 1) {
        redrawBtn.disabled = true;
        redrawBtn.textContent = t('draw.redraw.used');
      } else {
        redrawBtn.disabled = false;
        redrawBtn.textContent = t('draw.redraw');
      }
    }
  }

  // Render collected chips from previous steps
  renderCollectedChips(state);
}

function renderCollectedChips(state) {
  // For blue step: show red chip
  const blueCollected = dom.stepCollected['blue'];
  if (blueCollected) {
    blueCollected.innerHTML = '';
    if (state.drawnTokens.red) {
      blueCollected.appendChild(createChip('red', state.drawnTokens.red));
    }
  }

  // For green step: show red and blue chips
  const greenCollected = dom.stepCollected['green'];
  if (greenCollected) {
    greenCollected.innerHTML = '';
    if (state.drawnTokens.red) {
      greenCollected.appendChild(createChip('red', state.drawnTokens.red));
    }
    if (state.drawnTokens.blue) {
      greenCollected.appendChild(createChip('blue', state.drawnTokens.blue));
    }
  }
}

function createChip(color, token) {
  const chip = document.createElement('div');
  chip.className = `collected-chip collected-chip--${color}`;

  const emoji = document.createElement('span');
  emoji.className = 'collected-chip__emoji';
  emoji.textContent = token.emoji || '';

  const label = document.createElement('span');
  label.className = 'collected-chip__label';
  label.textContent = (getLocale() === 'en' && token.labelEn) ? token.labelEn : (token.label || '');

  chip.append(emoji, label);
  return chip;
}

/* ----------------------------------------------------------
   Render Functions per Step
   ---------------------------------------------------------- */

function renderReview(state) {
  const tokens = state.drawnTokens;

  fillTokenCard(dom.reviewTokenRed, tokens.red);
  fillTokenCard(dom.reviewTokenBlue, tokens.blue);
  fillTokenCard(dom.reviewTokenGreen, tokens.green);

  const combo = formatCombo(tokens);
  dom.reviewComboText.textContent = `"${combo}"`;
}

function fillTokenCard(cardEl, token) {
  if (!token || !cardEl) return;
  const emojiEl = cardEl.querySelector('.token-card__emoji');
  const labelEl = cardEl.querySelector('.token-card__label');

  if (emojiEl) {
    emojiEl.textContent = token.emoji;
  }

  if (labelEl) labelEl.textContent = (getLocale() === 'en' && token.labelEn) ? token.labelEn : token.label;
}

function renderWriting(state) {
  dom.inputStory.value = state.userStory;
  dom.charCount.textContent = state.userStory.length;
}

function renderComplete(state) {
  dom.completeCombo.textContent = formatCombo(state.drawnTokens);
  dom.completeStory.textContent = state.userStory;

  renderStarRating(state.rating);
}

function renderStarRating(rating) {
  if (!dom.starRating) return;
  const stars = dom.starRating.querySelectorAll('.star');
  stars.forEach(star => {
    const val = parseInt(star.dataset.value, 10);
    if (val <= rating) {
      star.textContent = '\u2605';
      star.classList.add('active');
    } else {
      star.textContent = '\u2606';
      star.classList.remove('active');
    }
  });
}

function renderHistory(state, historyData) {
  if (!historyData || !historyData.sessions || historyData.sessions.length === 0) {
    dom.historyList.innerHTML =
      `<p class="history__empty narrative-font">${t('history.empty')}</p>`;
    dom.statsTotal.textContent = t('history.statsTotal', { count: 0 });
    dom.statsAvgRating.innerHTML = t('history.statsAvg', { avg: '0' });
    return;
  }

  const sessions = historyData.sessions;
  const stats = historyData.stats || {};

  dom.statsTotal.textContent = t('history.statsTotal', { count: stats.totalPlayed || sessions.length });
  const avgRating = stats.averageRating
    ? stats.averageRating.toFixed(1)
    : '0';
  dom.statsAvgRating.innerHTML = t('history.statsAvg', { avg: avgRating });

  let html = '';
  sessions.forEach((session, idx) => {
    const number = sessions.length - idx;
    const date = session.completedAt ? formatDate(session.completedAt) : '';
    const combo = formatSessionCombo(session);
    const worldName = session.worldName || '';
    const ratingStars = '\u2605'.repeat(session.rating || 0)
                      + '\u2606'.repeat(5 - (session.rating || 0));

    html += `
      <div class="history-card">
        <div class="history-card__header">
          <span class="history-card__number">#${number}</span>
          <span class="history-card__date">${date}</span>
        </div>
        <p class="history-card__combo">"${combo}"</p>
        <p class="history-card__world">${t('history.worldPrefix')}${worldName}</p>
        <p class="history-card__rating">${ratingStars}</p>
      </div>
    `;
  });

  dom.historyList.innerHTML = html;
}

/**
 * Build locale-aware combo text for a history session.
 * Session tokens may lack labelEn (saved before i18n), so look them up from TOKEN_REGISTRY.
 */
function formatSessionCombo(session) {
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

function lookupLabelEn(token) {
  if (!token?.id) return '';
  if (token.labelEn) return token.labelEn;
  const color = token.id.split('-')[0];
  const pouch = TOKEN_REGISTRY.pouches[color];
  if (!pouch) return '';
  const found = pouch.tokens.find(t => t.id === token.id);
  return found?.labelEn || '';
}

/* ----------------------------------------------------------
   Main Render — called on every state change
   ---------------------------------------------------------- */

let _lastState = null;

function renderCurrentStep(state, historyData = null) {
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

function render(state, action, payload, historyData = null) {
  _lastState = state;

  // Clear auto-write timer on RETRY/RESTART/GO_BACK
  if (action === 'RETRY' || action === 'RESTART' || action === 'GO_BACK') {
    clearAutoWriteTimer();
  }

  // 1. Update layer visibility
  updateVisibility(state);

  // 2. Derive current step and transition
  const newStep = deriveStep(state);
  transitionToStep(newStep);

  // 3. Render step content + history overlay
  renderCurrentStep(state, historyData);
}

/* ----------------------------------------------------------
   Public API
   ---------------------------------------------------------- */

let _historyLoader = null;

/**
 * Initialize the renderer. Call once after DOM is ready.
 */
export function initRenderer(stateInstance, historyLoader = null) {
  cacheDOM();
  _historyLoader = historyLoader;
  _stateDispatcher = stateInstance;

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
    render(state, action, payload, historyData);
  });

  // Initial render
  const initialState = stateInstance.getState();
  render(initialState, 'INIT', null);
}

/**
 * Re-render current step using cached state. Call after locale switch.
 */
export function refreshLocale() {
  if (_lastState) {
    const historyData = (_lastState.phase === PHASES.HISTORY && _historyLoader)
      ? _historyLoader()
      : null;
    renderCurrentStep(_lastState, historyData);
  }
}

/**
 * Expose for use by pouch.js animation and app.js.
 */
export { renderStarRating };
