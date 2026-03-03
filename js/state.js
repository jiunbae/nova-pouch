/* ============================================================
   state.js — Observer-pattern State Management (Singleton)
   ============================================================ */

/**
 * Valid game phases.
 */
export const PHASES = Object.freeze({
  IDLE: 'IDLE',
  DRAWING: 'DRAWING',
  REVIEW: 'REVIEW',
  WRITING: 'WRITING',
  COMPLETE: 'COMPLETE',
  HISTORY: 'HISTORY',
});

/**
 * Action types for dispatch.
 */
export const ACTIONS = Object.freeze({
  START_GAME: 'START_GAME',
  DRAW_TOKEN: 'DRAW_TOKEN',
  CONFIRM_TOKEN: 'CONFIRM_TOKEN',
  REDRAW_TOKEN: 'REDRAW_TOKEN',
  START_WRITING: 'START_WRITING',
  BACK_TO_REVIEW: 'BACK_TO_REVIEW',
  UPDATE_WORLD_NAME: 'UPDATE_WORLD_NAME',
  UPDATE_STORY: 'UPDATE_STORY',
  COMPLETE: 'COMPLETE',
  SET_RATING: 'SET_RATING',
  RESTART: 'RESTART',
  RETRY: 'RETRY',
  VIEW_HISTORY: 'VIEW_HISTORY',
  CLOSE_HISTORY: 'CLOSE_HISTORY',
  BACK_HOME: 'BACK_HOME',
  SET_ANIMATING: 'SET_ANIMATING',
  GO_BACK: 'GO_BACK',
});

/**
 * Pouch draw order.
 */
const POUCH_ORDER = ['red', 'blue', 'green'];

/**
 * Map from currentPouch to next pouch (or null for REVIEW).
 */
const NEXT_POUCH = {
  red: 'blue',
  blue: 'green',
  green: null,
};

const PREV_POUCH = {
  blue: 'red',
  green: 'blue',
};

/**
 * Creates the initial blank state.
 * @returns {Object}
 */
function createInitialState() {
  return {
    phase: PHASES.IDLE,
    currentPouch: null,
    drawnTokens: {
      red: null,
      blue: null,
      green: null,
    },
    confirmedPouches: {
      red: false,
      blue: false,
      green: false,
    },
    redraws: {
      red: 0,
      blue: 0,
      green: 0,
    },
    lastDrawn: {
      red: null,
      blue: null,
      green: null,
    },
    worldName: '',
    userStory: '',
    rating: 0,
    isAnimating: false,
    _prevPhase: null,
  };
}

/**
 * GameState — Singleton class with Observer pattern.
 */
class GameState {
  constructor() {
    /** @private */
    this._state = createInitialState();
    /** @private @type {Set<Function>} */
    this._listeners = new Set();
  }

  /**
   * Get a frozen snapshot of the current state.
   * @returns {Object}
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Subscribe a listener to state changes.
   * @param {(state: Object, action: string, payload: any) => void} listener
   * @returns {() => void} Unsubscribe function
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Dispatch an action to mutate state.
   * @param {string} action - One of ACTIONS
   * @param {*} [payload] - Optional payload
   */
  dispatch(action, payload) {
    const prev = this._state;

    if (prev.isAnimating && action !== ACTIONS.SET_ANIMATING
        && action !== ACTIONS.DRAW_TOKEN && action !== ACTIONS.REDRAW_TOKEN
        && action !== ACTIONS.GO_BACK) {
      return;
    }

    this._reduce(action, payload);
    this._notify(action, payload);
  }

  /**
   * @private Reducer — mutate _state based on action.
   */
  _reduce(action, payload) {
    const s = this._state;

    switch (action) {
      case ACTIONS.START_GAME:
        s.phase = PHASES.DRAWING;
        s.currentPouch = 'red';
        s.drawnTokens = { red: null, blue: null, green: null };
        s.confirmedPouches = { red: false, blue: false, green: false };
        s.redraws = { red: 0, blue: 0, green: 0 };
        s.lastDrawn = { red: null, blue: null, green: null };
        s.worldName = '';
        s.userStory = '';
        s.rating = 0;
        break;

      case ACTIONS.DRAW_TOKEN: {
        const { pouch, token } = payload;
        s.drawnTokens[pouch] = token;
        break;
      }

      case ACTIONS.CONFIRM_TOKEN: {
        const pouch = s.currentPouch;
        if (pouch && s.drawnTokens[pouch]) {
          s.confirmedPouches[pouch] = true;
          const next = NEXT_POUCH[pouch];
          if (next) {
            s.currentPouch = next;
          } else {
            // All 3 confirmed → move to REVIEW
            s.currentPouch = null;
            s.phase = PHASES.REVIEW;
          }
        }
        break;
      }

      case ACTIONS.REDRAW_TOKEN: {
        const { pouch, token } = payload;
        if (s.redraws[pouch] < 1) {
          s.lastDrawn[pouch] = s.drawnTokens[pouch];
          s.drawnTokens[pouch] = token;
          s.redraws[pouch] = 1;
        }
        break;
      }

      case ACTIONS.START_WRITING:
        s.phase = PHASES.WRITING;
        break;

      case ACTIONS.BACK_TO_REVIEW:
        s.phase = PHASES.REVIEW;
        break;

      case ACTIONS.UPDATE_WORLD_NAME:
        s.worldName = payload || '';
        break;

      case ACTIONS.UPDATE_STORY:
        s.userStory = payload || '';
        break;

      case ACTIONS.COMPLETE:
        s.phase = PHASES.COMPLETE;
        break;

      case ACTIONS.SET_RATING:
        s.rating = payload || 0;
        break;

      case ACTIONS.RESTART:
        Object.assign(s, createInitialState());
        break;

      case ACTIONS.RETRY:
        // Reset tokens and go back to DRAWING from REVIEW
        s.phase = PHASES.DRAWING;
        s.currentPouch = 'red';
        s.drawnTokens = { red: null, blue: null, green: null };
        s.confirmedPouches = { red: false, blue: false, green: false };
        s.redraws = { red: 0, blue: 0, green: 0 };
        s.lastDrawn = { red: null, blue: null, green: null };
        break;

      case ACTIONS.VIEW_HISTORY:
        s._prevPhase = s.phase;
        s.phase = PHASES.HISTORY;
        break;

      case ACTIONS.CLOSE_HISTORY:
        s.phase = s._prevPhase || PHASES.IDLE;
        s._prevPhase = null;
        break;

      case ACTIONS.BACK_HOME:
        Object.assign(s, createInitialState());
        break;

      case ACTIONS.SET_ANIMATING:
        s.isAnimating = !!payload;
        break;

      case ACTIONS.GO_BACK: {
        if (s.phase === PHASES.HISTORY) {
          // Same as CLOSE_HISTORY
          s.phase = s._prevPhase || PHASES.IDLE;
          s._prevPhase = null;
          break;
        }
        if (s.phase === PHASES.COMPLETE) {
          s.phase = PHASES.WRITING;
          break;
        }
        if (s.phase === PHASES.WRITING) {
          s.phase = PHASES.REVIEW;
          break;
        }
        if (s.phase === PHASES.REVIEW) {
          s.phase = PHASES.DRAWING;
          s.currentPouch = 'green';
          s.drawnTokens.green = null;
          s.confirmedPouches.green = false;
          s.redraws.green = 0;
          s.lastDrawn.green = null;
          break;
        }
        if (s.phase === PHASES.DRAWING) {
          const prev = PREV_POUCH[s.currentPouch];
          if (prev) {
            // Go to previous pouch, clearing the previous pouch's data
            s.currentPouch = prev;
            s.drawnTokens[prev] = null;
            s.confirmedPouches[prev] = false;
            s.redraws[prev] = 0;
            s.lastDrawn[prev] = null;
          } else {
            // At red (first pouch) — go back to IDLE
            Object.assign(s, createInitialState());
          }
          break;
        }
        break;
      }

      default:
        console.warn(`[GameState] Unknown action: ${action}`);
    }
  }

  /**
   * @private Notify all subscribed listeners.
   */
  _notify(action, payload) {
    const snapshot = this.getState();
    for (const listener of this._listeners) {
      try {
        listener(snapshot, action, payload);
      } catch (err) {
        console.error('[GameState] Listener error:', err);
      }
    }
  }
}

/**
 * Singleton instance.
 */
export const gameState = new GameState();
