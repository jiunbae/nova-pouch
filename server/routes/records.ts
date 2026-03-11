import { getCookie, setCookie } from 'hono/cookie';
import { Hono } from 'hono';
import { config } from '../config';
import { handleError } from '../lib/errorHandler';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import type { DailyTokens } from '../models/record';
import type { AppBindings } from '../types';
import {
  createRecord,
  getDailyTokens,
  getRecord,
  getRecords,
  getTodayDateString,
  getUserRecords,
  toggleLike,
} from '../services/record.service';

type CreateRecordBody = {
  date?: string;
  tokens?: DailyTokens;
  story?: string;
  anonName?: string;
};

const recordRoutes = new Hono<AppBindings>();

function parsePositiveInt(value: string | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(max, Math.floor(parsed));
}

function parseSort(value: string | undefined): 'likes' | 'newest' {
  return value === 'likes' ? 'likes' : 'newest';
}

const createRateLimit = rateLimiter({ windowMs: 60_000, max: 10, keyPrefix: 'create' });
const likeRateLimit = rateLimiter({ windowMs: 60_000, max: 30, keyPrefix: 'like' });

recordRoutes.get('/daily', (c) => {
  const today = getTodayDateString();
  return c.json({ date: today, tokens: getDailyTokens(today) });
});

recordRoutes.get('/records', async (c) => {
  try {
    const date = c.req.query('date');
    const page = parsePositiveInt(c.req.query('page'), 1);
    const limit = parsePositiveInt(c.req.query('limit'), 20, 100);
    const sort = parseSort(c.req.query('sort'));
    const result = await getRecords({ date, page, limit, sort });
    return c.json(result);
  } catch (error) {
    return handleError(c, error, 'Failed to fetch records');
  }
});

recordRoutes.get('/records/me', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (!user?.sub) return c.json({ error: 'Unauthorized' }, 401);
    const records = await getUserRecords(user.sub);
    return c.json({ records });
  } catch (error) {
    return handleError(c, error, 'Failed to fetch user records');
  }
});

recordRoutes.get('/records/:id', async (c) => {
  try {
    const record = await getRecord(c.req.param('id'));
    if (!record) return c.json({ error: 'Record not found' }, 404);
    return c.json({ record });
  } catch (error) {
    return handleError(c, error, 'Failed to fetch record');
  }
});

recordRoutes.post('/records', createRateLimit, optionalAuth, async (c) => {
  try {
    const body = (await c.req.json()) as CreateRecordBody;
    const user = c.get('user');

    if (!body || typeof body.story !== 'string') {
      return c.json({ error: 'Invalid request body. `story` is required.' }, 400);
    }

    const date = body.date || getTodayDateString();
    const tokens = body.tokens || getDailyTokens(date);

    const record = await createRecord({
      date,
      tokens,
      story: body.story,
      anonName: body.anonName,
      userId: user?.sub,
    });

    return c.json({ record }, 201);
  } catch (error) {
    return handleError(c, error, 'Failed to create record');
  }
});

recordRoutes.post('/records/:id/like', likeRateLimit, optionalAuth, async (c) => {
  try {
    const user = c.get('user');
    let anonFingerprint = c.req.header('x-anon-fingerprint')?.slice(0, 64) || getCookie(c, 'anon_fingerprint');

    if (!user?.sub && !anonFingerprint) {
      anonFingerprint = crypto.randomUUID();
      setCookie(c, 'anon_fingerprint', anonFingerprint, {
        httpOnly: false,
        secure: config.isProduction,
        sameSite: 'Lax',
        path: '/',
        maxAge: 365 * 24 * 60 * 60,
      });
    }

    const result = await toggleLike(c.req.param('id'), user?.sub, anonFingerprint);
    return c.json(result);
  } catch (error) {
    return handleError(c, error, 'Failed to toggle like');
  }
});

export { recordRoutes };
