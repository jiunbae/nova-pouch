/* share.ts — Share Card Generation + Social Sharing */

import { getDailyNumber, todayDateString } from './daily';
import { getLocale } from './i18n';
import type { GameStateSnapshot, ShareCardData, Token } from './types';

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

function getCardDimensions(): { width: number; height: number } {
  return { width: CARD_WIDTH, height: CARD_HEIGHT };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = text.split('\n');
  let currentY = y;

  lines.forEach(lineText => {
    let line = '';
    const chars = Array.from(lineText);
    for (const char of chars) {
      const testLine = line + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = char;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  });
  
  return currentY;
}

function renderCard(ctx: CanvasRenderingContext2D, data: ShareCardData, w: number, h: number): void {
  // 1. Warm Background (matches app palette)
  ctx.fillStyle = '#F5EDE0';
  ctx.fillRect(0, 0, w, h);

  // Subtle radial gradient accents
  const grad = ctx.createRadialGradient(w * 0.1, h * 0.2, 0, w * 0.1, h * 0.2, w * 0.5);
  grad.addColorStop(0, 'rgba(184, 134, 11, 0.05)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 2. Header: Date/Day Number
  const dayNum = getDailyNumber(data.date || todayDateString());
  ctx.fillStyle = '#B8860B';
  ctx.font = `bold ${Math.round(w * 0.025)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`#${dayNum} · ${data.date}`, w / 2, h * 0.08);

  // 3. Token Cards (Tactile rows)
  const tokens = [
    { type: 'red', token: data.red, color: '#C0392B', bg: '#FFF0F1' },
    { type: 'blue', token: data.blue, color: '#2471A3', bg: '#F0F7FF' },
    { type: 'green', token: data.green, color: '#1E8449', bg: '#F0FFF9' }
  ];

  let startY = h * 0.14;
  const cardH = h * 0.08;
  const cardW = w * 0.8;
  const cardX = (w - cardW) / 2;
  const gap = h * 0.015;

  tokens.forEach((item) => {
    if (!item.token) return;
    
    // Shadow
    ctx.shadowColor = 'rgba(101, 78, 50, 0.1)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    
    // Card Background
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, cardX, startY, cardW, cardH, 20);
    ctx.fill();
    
    // Border
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(139, 119, 90, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Color bar (Left accent)
    ctx.fillStyle = item.color;
    roundRectCustom(ctx, cardX, startY, 12, cardH, { tl: 20, bl: 20 });
    ctx.fill();

    // Emoji
    ctx.font = `${Math.round(cardH * 0.5)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(item.token.emoji || '', cardX + 40, startY + cardH * 0.65);

    // Label
    ctx.fillStyle = '#3B2F2F';
    ctx.font = `bold ${Math.round(cardH * 0.3)}px sans-serif`;
    const label = data.locale === 'en' ? (item.token.labelEn || item.token.label) : item.token.label;
    ctx.fillText(label || '', cardX + 120, startY + cardH * 0.65);

    startY += cardH + gap;
  });

  // 4. Summary Combo
  startY += gap;
  ctx.fillStyle = '#3B2F2F';
  ctx.font = `bold ${Math.round(w * 0.045)}px sans-serif`;
  ctx.textAlign = 'center';
  const combo = buildComboText(data);
  ctx.fillText(combo, w / 2, startY + 40);

  // 5. Story Card
  startY += 100;
  const storyW = w * 0.85;
  const storyX = (w - storyW) / 2;
  const storyPadding = 60;
  
  ctx.fillStyle = '#FFFCF5';
  ctx.shadowColor = 'rgba(101, 78, 50, 0.08)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 15;
  
  // Measure story height first
  const storyFont = `${Math.round(w * 0.032)}px serif`;
  ctx.font = storyFont;
  const lineHeight = Math.round(w * 0.032) * 1.7;
  
  // Temporary canvas to measure height
  const storyHeight = measureWrapTextHeight(ctx, data.story || '', storyW - storyPadding * 2, lineHeight) + storyPadding * 2;
  
  roundRect(ctx, storyX, startY, storyW, Math.max(storyHeight, 200), 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(139, 119, 90, 0.2)';
  ctx.stroke();
  
  // Top gold accent bar on story card
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#B8860B';
  roundRectCustom(ctx, storyX, startY, storyW, 8, { tl: 24, tr: 24 });
  ctx.fill();

  // Draw Story Text
  ctx.fillStyle = '#3B2F2F';
  ctx.textAlign = 'left';
  wrapText(ctx, data.story || '', storyX + storyPadding, startY + storyPadding + 40, storyW - storyPadding * 2, lineHeight);

  // 6. Branding Footer
  ctx.fillStyle = '#8B775A';
  ctx.font = `bold ${Math.round(w * 0.02)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('NOVA POUCH', w / 2, h - 80);
}

function buildComboText(data: ShareCardData): string {
  const parts = [];
  if (data.green) parts.push(data.locale === 'en' ? (data.green.labelEn || data.green.label) : data.green.label);
  if (data.blue) parts.push(data.locale === 'en' ? (data.blue.labelEn || data.blue.label) : data.blue.label);
  if (data.red) parts.push(data.locale === 'en' ? (data.red.labelEn || data.red.label) : data.red.label);
  return parts.join(' ');
}

function measureWrapTextHeight(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, lineHeight: number): number {
  const lines = text.split('\n');
  let count = 0;
  lines.forEach(lineText => {
    let line = '';
    const chars = Array.from(lineText);
    for (const char of chars) {
      const testLine = line + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line) {
        line = char;
        count++;
      } else {
        line = testLine;
      }
    }
    count++;
  });
  return count * lineHeight;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

function roundRectCustom(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: {tl?: number, tr?: number, br?: number, bl?: number}): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, [r.tl || 0, r.tr || 0, r.br || 0, r.bl || 0]);
  ctx.closePath();
}

export async function generateShareCard(state: Partial<GameStateSnapshot> & { dailyDate?: string }): Promise<Blob | null> {
  await document.fonts.ready;

  const { width, height } = getCardDimensions();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const cardData: ShareCardData = {
    red: state.drawnTokens?.red,
    blue: state.drawnTokens?.blue,
    green: state.drawnTokens?.green,
    story: state.userStory || '',
    date: state.dailyDate || todayDateString(),
    locale: getLocale(),
  };

  renderCard(ctx, cardData, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;
      resolve(blob);
    }, 'image/png');
  });
}

export async function downloadShareCard(state: Partial<GameStateSnapshot> & { dailyDate?: string }): Promise<void> {
  const blob = await generateShareCard(state);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nova-pouch-${state.dailyDate || todayDateString()}.png`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 1000);
}

export function shareToTwitter(state: Partial<GameStateSnapshot> & { dailyDate?: string } = {}): void {
  const full = buildCompactShare(state);
  const maxLen = 270;
  const text = full.length > maxLen ? full.slice(0, maxLen - 1) + '\u2026' : full;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

export function buildShareLink(state: Partial<GameStateSnapshot>): string {
  const url = new URL(window.location.origin + window.location.pathname);
  
  if (state.recordId) {
    url.searchParams.set('r', state.recordId);
    return url.toString();
  }

  const tokens = state.drawnTokens;
  if (tokens?.red) url.searchParams.set('red', tokens.red.id);
  if (tokens?.blue) url.searchParams.set('blue', tokens.blue.id);
  if (tokens?.green) url.searchParams.set('green', tokens.green.id);
  if (state.userStory) url.searchParams.set('story', state.userStory);
  return url.toString();
}

export function buildCompactShare(state: Partial<GameStateSnapshot> & { dailyDate?: string } = {}): string {
  const tokens = state.drawnTokens || { red: null, blue: null, green: null };
  const date = state.dailyDate || todayDateString();
  const dayNum = getDailyNumber(date);

  const redLine = tokens.red ? `🔴 ${tokens.red.emoji} ${tokens.red.label}` : '';
  const blueLine = tokens.blue ? `🔵 ${tokens.blue.emoji} ${tokens.blue.label}` : '';
  const greenLine = tokens.green ? `🟢 ${tokens.green.emoji} ${tokens.green.label}` : '';
  const story = (state.userStory || '').trim();
  const link = buildShareLink(state);

  const lines = [
    `✦ Nova Pouch #${dayNum} (${date})`,
    '',
    redLine,
    blueLine,
    greenLine,
  ].filter(Boolean);

  if (story) {
    lines.push('', story);
  }

  lines.push('', 'Link: ' + link);
  lines.push('', 'nova-pouch.app');

  return lines.join('\n');
}

export async function nativeShare(state: Partial<GameStateSnapshot> & { dailyDate?: string }): Promise<'shared' | 'clipboard' | 'failed'> {
  if (!navigator.share) {
    const ok = await clipboardShare(buildCompactShare(state));
    return ok ? 'clipboard' : 'failed';
  }

  const shareData: ShareData = { title: 'Nova Pouch', text: buildCompactShare(state) };

  const canShareFiles = navigator.canShare &&
    navigator.canShare({ files: [new File([], 't.png', { type: 'image/png' })] });

  if (canShareFiles) {
    try {
      const blob = await generateShareCard(state);
      if (blob) {
        const date = state.dailyDate || todayDateString();
        shareData.files = [new File([blob], `nova-pouch-${date}.png`, { type: 'image/png' })];
      }
    } catch { /* fallback */ }
  }

  try {
    await navigator.share(shareData);
    return 'shared';
  } catch (err) {
    if ((err as Error).name !== 'AbortError') console.warn('Share failed:', err);
    return 'failed';
  }
}

export async function clipboardShare(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
