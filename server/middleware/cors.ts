import { cors } from 'hono/cors';
import { config } from '../config';

const ALLOWED_ORIGINS = [
  config.siteUrl,
  'http://localhost:5173',
  'http://localhost:3000',
];

export const corsMiddleware = cors({
  origin: (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : ''),
  credentials: true,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Anon-Fingerprint'],
  maxAge: 86400,
});
