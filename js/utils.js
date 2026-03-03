/* ============================================================
   utils.js — Utility Functions
   ============================================================ */

/**
 * Weighted random pick from an array.
 * @param {Array} items - Array of items to pick from
 * @param {(item: any) => number} weightFn - Function returning weight for an item
 * @param {string|null} [excludeId=null] - Optional ID to exclude
 * @returns {*} Randomly selected item
 */
export function weightedPick(items, weightFn, excludeId = null) {
  const candidates = excludeId
    ? items.filter(item => item.id !== excludeId)
    : items;

  if (candidates.length === 0) {
    return null;
  }

  const weights = candidates.map(item => Math.max(weightFn(item), 0));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight === 0) {
    // Fallback: uniform random
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  let r = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      return candidates[i];
    }
  }

  // Fallback (floating point edge case)
  return candidates[candidates.length - 1];
}

/**
 * Fisher-Yates shuffle (in-place, returns same array).
 * @param {Array} arr
 * @returns {Array} The shuffled array (same reference)
 */
export function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Format an ISO date string to "YYYY-MM-DD" or locale string.
 * @param {string} isoString - ISO 8601 date string
 * @returns {string} Formatted date
 */
export function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return isoString;
  }
}

/**
 * Generate a unique session ID based on timestamp + random suffix.
 * @returns {string} e.g. "session-1709312400000-a3f2"
 */
export function generateId() {
  const timestamp = Date.now();
  const suffix = Math.random().toString(36).substring(2, 6);
  return `session-${timestamp}-${suffix}`;
}

/**
 * Create a debounced version of a function.
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, ms) {
  let timer = null;
  return function (...args) {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, ms);
  };
}

/**
 * Clamp a value between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Simple sleep/delay helper using Promise.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a string meets minimum length (non-whitespace).
 * @param {string} str
 * @param {number} minLength
 * @returns {boolean}
 */
export function meetsMinLength(str, minLength) {
  return str.trim().length >= minLength;
}

/**
 * Try to trigger haptic feedback on supported devices.
 * Fails silently on unsupported devices.
 * @param {number} [duration=10] - Vibration duration in ms
 */
export function hapticFeedback(duration = 10) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  } catch {
    // Silently ignore
  }
}
