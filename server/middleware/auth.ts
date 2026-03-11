import type { Context, MiddlewareHandler } from 'hono';
import { jwtVerify } from 'jose';
import { config } from '../config';
import type { AppBindings, AuthTokenPayload } from '../types';

function getBearerToken(c: Context): string | null {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

async function attachUserFromToken(c: Context<AppBindings>): Promise<AuthTokenPayload | null> {
  const token = getBearerToken(c);
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(config.jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    const authPayload = payload as AuthTokenPayload;

    if (authPayload.type === 'refresh') return null;

    c.set('user', authPayload);
    return authPayload;
  } catch {
    return null;
  }
}

export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = await attachUserFromToken(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await next();
};

export const optionalAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  await attachUserFromToken(c);
  await next();
};
