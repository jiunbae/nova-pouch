import { Hono } from 'hono';
import { getDb } from '../db/mongo';

const healthRoutes = new Hono();

healthRoutes.get('/health', async (c) => {
  try {
    const db = getDb();
    await db.command({ ping: 1 });
    return c.json({ status: 'ok' });
  } catch {
    return c.json({ status: 'unhealthy' }, 503);
  }
});

export { healthRoutes };
