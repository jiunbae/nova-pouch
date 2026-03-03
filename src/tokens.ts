/* ============================================================
   tokens.ts — Token Selection Logic & Utilities
   ============================================================
   Data lives in ./data/token-registry.json.
   This file provides typed access and selection functions.
   ============================================================ */

import { weightedPick } from './utils';
import { getLocale } from './i18n';
import registryData from './data/token-registry.json';
import type { PouchColor, RegistryToken, TokenRegistry, DifficultyResult, Token } from './types';

export const TOKEN_REGISTRY: TokenRegistry = registryData as TokenRegistry;

/**
 * Get all tokens for a specific pouch type.
 */
export function getTokensByPouch(pouchType: PouchColor): RegistryToken[] {
  const pouch = TOKEN_REGISTRY.pouches[pouchType];
  if (!pouch) {
    throw new Error(`Unknown pouch type: ${pouchType}`);
  }
  return pouch.tokens;
}

/**
 * Get pouch metadata (name, lore, color).
 */
export function getPouchMeta(pouchType: PouchColor): { name: string; lore: string; color: string } {
  const pouch = TOKEN_REGISTRY.pouches[pouchType];
  if (!pouch) {
    throw new Error(`Unknown pouch type: ${pouchType}`);
  }
  return { name: pouch.name, lore: pouch.lore, color: pouch.color };
}

/**
 * Randomly select a token from the given pouch, optionally excluding one.
 * Uses weighted pick based on difficulty (higher difficulty = rarer).
 */
export function getRandomToken(pouchType: PouchColor, excludeId: string | null = null): RegistryToken | null {
  const tokens = getTokensByPouch(pouchType);
  const candidates = excludeId
    ? tokens.filter(t => t.id !== excludeId)
    : tokens;

  return weightedPick(
    candidates,
    (token) => 4 - token.difficulty,
  );
}

/**
 * Get a specific token by its ID from the registry.
 */
export function getTokenById(pouchType: PouchColor, id: string): RegistryToken | null {
  const tokens = getTokensByPouch(pouchType);
  return tokens.find(t => t.id === id) || null;
}

/**
 * Format a combination of tokens into a descriptive string.
 */
export function formatCombo(tokens: { red?: Token | null; blue?: Token | null; green?: Token | null }): string {
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
 */
export function calculateDifficulty(tokens: { red?: Token | null; blue?: Token | null; green?: Token | null }): DifficultyResult {
  if (!tokens.red || !tokens.blue || !tokens.green) {
    return { sum: 0, stars: 0, label: '' };
  }

  const sum = (tokens.red.difficulty || 0) + (tokens.blue.difficulty || 0) + (tokens.green.difficulty || 0);

  let stars: number;
  let label: string;
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
 */
export function renderDifficultyStars(stars: number): string {
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
