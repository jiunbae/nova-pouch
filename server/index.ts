import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from 'hono/bun';
import { config } from './config';

const app = new Hono();

const API_BASE = 'https://api.jiun.dev/nova-pouch';
const BOT_UA_RE = /bot|crawl|spider|slurp|facebookexternalhit|Twitterbot|LinkedInBot|Discordbot|TelegramBot|WhatsApp|Googlebot/i;

// Security headers
app.use('*', secureHeaders());

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// /records/:id — redirect crawlers to jiun-api OG endpoint, serve SPA for browsers
app.get('/records/:id', async (c) => {
  const ua = c.req.header('user-agent') || '';
  if (BOT_UA_RE.test(ua)) {
    const id = c.req.param('id');
    return c.redirect(`${API_BASE}/records/${id}/og`, 302);
  }
  return serveStatic({ root: './dist', path: 'index.html' })(c, async () => {});
});

// /w/:shortId — redirect to jiun-api short URL handler
app.get('/w/:shortId', (c) => {
  const shortId = c.req.param('shortId');
  return c.redirect(`${API_BASE}/w/${shortId}`, 302);
});

// Static files (Vite build output)
app.use('/*', serveStatic({ root: './dist' }));

// SPA fallback: serve index.html for unmatched routes
app.use('/*', serveStatic({ root: './dist', path: 'index.html' }));

console.log(`nova-pouch server listening on port ${config.port}`);

export default {
  port: config.port,
  fetch: app.fetch,
};
