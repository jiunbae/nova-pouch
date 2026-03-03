/* ============================================================
   utils.ts — Utility Functions
   ============================================================ */

/**
 * Weighted random pick from an array.
 */
export function weightedPick<T extends { id?: string }>(
  items: T[],
  weightFn: (item: T) => number,
  excludeId: string | null = null,
): T | null {
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
 */
export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Format an ISO date string to "YYYY-MM-DD".
 */
export function formatDate(isoString: string): string {
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
 */
export function generateId(): string {
  const timestamp = Date.now();
  const suffix = Math.random().toString(36).substring(2, 6);
  return `session-${timestamp}-${suffix}`;
}

/**
 * Create a debounced version of a function.
 */
export function debounce(fn: (...args: unknown[]) => void, ms: number): (...args: unknown[]) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: unknown[]) {
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
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Simple sleep/delay helper using Promise.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a string meets minimum length (non-whitespace).
 */
export function meetsMinLength(str: string, minLength: number): boolean {
  return str.trim().length >= minLength;
}

/**
 * Try to trigger haptic feedback on supported devices.
 * Fails silently on unsupported devices.
 */
export function hapticFeedback(duration = 10): void {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  } catch {
    // Silently ignore
  }
}
