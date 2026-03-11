import { Hono } from 'hono';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { config } from '../config';
import { handleError } from '../lib/errorHandler';
import { getRecord, getRecordByShortId } from '../services/record.service';

const ogRoutes = new Hono();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

const SHORT_ID_RE = /^[a-zA-Z0-9]{7}$/;

function buildOgHtml(opts: { title: string; description: string; imageUrl: string; redirectUrl: string }): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.title)}</title>
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(opts.title)}">
  <meta property="og:description" content="${escapeHtml(opts.description)}">
  <meta property="og:image" content="${escapeHtml(opts.imageUrl)}">
  <meta property="og:url" content="${escapeHtml(opts.redirectUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(opts.title)}">
  <meta name="twitter:description" content="${escapeHtml(opts.description)}">
  <meta name="twitter:image" content="${escapeHtml(opts.imageUrl)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(opts.redirectUrl)}">
</head>
<body>
  <p>Redirecting... <a href="${escapeHtml(opts.redirectUrl)}">Click here</a> if not redirected.</p>
</body>
</html>`;
}

// Short ID redirect with OG meta
ogRoutes.get('/w/:shortId', async (c) => {
  try {
    const shortId = c.req.param('shortId');
    if (!SHORT_ID_RE.test(shortId)) return c.redirect(config.siteUrl);
    const record = await getRecordByShortId(shortId);

    if (!record) return c.redirect(config.siteUrl);

    const redirectUrl = `${config.siteUrl}/records/${record.id}`;
    const { tokens, story } = record;
    const title = `Nova Pouch — ${tokens.green.label} ${tokens.blue.label} ${tokens.red.label}`;
    const description = truncate(story, 100);
    const imageUrl = `${config.siteUrl}/api/records/${record.id}/og-image.png`;

    return c.html(buildOgHtml({ title, description, imageUrl, redirectUrl }));
  } catch (error) {
    return handleError(c, error, 'Failed to generate OG page');
  }
});

// OG page by record ID
ogRoutes.get('/records/:id/og', async (c) => {
  try {
    const id = c.req.param('id');
    const record = await getRecord(id);
    const redirectUrl = `${config.siteUrl}/records/${id}`;

    if (!record) return c.redirect(config.siteUrl);

    const { tokens, story } = record;
    const title = `Nova Pouch — ${tokens.green.label} ${tokens.blue.label} ${tokens.red.label}`;
    const description = truncate(story, 100);
    const imageUrl = `${config.siteUrl}/api/records/${id}/og-image.png`;

    return c.html(buildOgHtml({ title, description, imageUrl, redirectUrl }));
  } catch (error) {
    return handleError(c, error, 'Failed to generate OG page');
  }
});

// OG image generation
let cachedFont: ArrayBuffer | null = null;

const FONT_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = FONT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

async function loadFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;

  const css = await fetchWithTimeout(
    'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap',
    { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } },
  ).then((r) => r.text());

  const fontUrlMatch = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:woff2|truetype)'\)/);
  if (!fontUrlMatch?.[1]) {
    throw new Error('Failed to extract font URL from Google Fonts CSS');
  }

  const fontData = await fetchWithTimeout(fontUrlMatch[1]).then((r) => r.arrayBuffer());
  cachedFont = fontData;
  return fontData;
}

export function preWarmFont(): void {
  loadFont().catch((err) => console.warn('Font pre-warm failed (will retry on first request):', err.message));
}

ogRoutes.get('/records/:id/og-image.png', async (c) => {
  try {
    const id = c.req.param('id');
    const record = await getRecord(id);

    if (!record) return c.json({ error: 'Record not found' }, 404);

    const { tokens, story, date } = record;

    const refDate = new Date('2024-01-01');
    const recordDate = new Date(date);
    const dayNumber = Math.floor((recordDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const storyTeaser = truncate(story, 150);
    const font = await loadFont();

    const tokenRows = [
      { color: '#C0392B', emoji: tokens.red.emoji, label: tokens.red.label },
      { color: '#2471A3', emoji: tokens.blue.emoji, label: tokens.blue.label },
      { color: '#1E8449', emoji: tokens.green.emoji, label: tokens.green.label },
    ];

    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '1200px',
            height: '630px',
            backgroundColor: '#F5EDE0',
            padding: '48px 60px',
            fontFamily: '"Noto Sans KR", sans-serif',
          },
          children: [
            {
              type: 'div',
              props: {
                style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
                children: [
                  { type: 'div', props: { style: { fontSize: '24px', color: '#8B7355', fontWeight: '400' }, children: date } },
                  { type: 'div', props: { style: { fontSize: '24px', color: '#8B7355', fontWeight: '400' }, children: `Day ${dayNumber}` } },
                ],
              },
            },
            ...tokenRows.map((token) => ({
              type: 'div',
              props: {
                style: { display: 'flex', alignItems: 'center', marginBottom: '16px', backgroundColor: '#FFFDF8', borderRadius: '12px', overflow: 'hidden' },
                children: [
                  { type: 'div', props: { style: { width: '8px', height: '64px', backgroundColor: token.color, flexShrink: '0' } } },
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', alignItems: 'center', padding: '16px 24px', gap: '16px' },
                      children: [
                        { type: 'span', props: { style: { fontSize: '32px' }, children: token.emoji } },
                        { type: 'span', props: { style: { fontSize: '28px', color: '#3E2F1C', fontWeight: '700' }, children: token.label } },
                      ],
                    },
                  },
                ],
              },
            })),
            {
              type: 'div',
              props: {
                style: { display: 'flex', flex: '1', alignItems: 'flex-start', marginTop: '16px' },
                children: {
                  type: 'p',
                  props: { style: { fontSize: '24px', color: '#5C4A32', lineHeight: '1.6', margin: '0' }, children: storyTeaser },
                },
              },
            },
            {
              type: 'div',
              props: {
                style: { display: 'flex', justifyContent: 'center', marginTop: 'auto', paddingTop: '16px' },
                children: {
                  type: 'span',
                  props: { style: { fontSize: '20px', color: '#B8A080', fontWeight: '700', letterSpacing: '4px' }, children: 'NOVA POUCH' },
                },
              },
            },
          ],
        },
      },
      {
        width: 1200,
        height: 630,
        fonts: [{ name: 'Noto Sans KR', data: font, weight: 400, style: 'normal' as const }],
      },
    );

    const resvg = new Resvg(svg, { fitTo: { mode: 'width' as const, value: 1200 } });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('OG image generation failed:', error);
    return handleError(c, error, 'Failed to generate OG image');
  }
});

/** Serve OG HTML for a record by ID — used by clean URL crawler detection */
async function buildRecordOgHtml(c: import('hono').Context, id: string) {
  try {
    const record = await getRecord(id);
    if (!record) return c.redirect(config.siteUrl);

    const redirectUrl = `${config.siteUrl}/records/${id}`;
    const { tokens, story } = record;
    const title = `Nova Pouch — ${tokens.green.label} ${tokens.blue.label} ${tokens.red.label}`;
    const description = truncate(story, 100);
    const imageUrl = `${config.siteUrl}/api/records/${id}/og-image.png`;

    return c.html(buildOgHtml({ title, description, imageUrl, redirectUrl }));
  } catch (error) {
    return handleError(c, error, 'Failed to generate OG page');
  }
}

export { ogRoutes, buildRecordOgHtml };
