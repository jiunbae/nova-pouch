const nodeEnv = process.env.NODE_ENV || 'development';

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseMongoDbName(uri: string): string {
  try {
    const dbName = new URL(uri).pathname.replace(/^\//, '');
    return dbName || 'nova-pouch';
  } catch {
    return 'nova-pouch';
  }
}

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/nova-pouch';

export const config = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',
  port: parsePort(process.env.PORT, 3000),
  mongoUri,
  mongoDbName: parseMongoDbName(mongoUri),
  jwtSecret: (() => {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (nodeEnv === 'production') throw new Error('JWT_SECRET is required in production');
    console.warn('Warning: Using default JWT secret. Set JWT_SECRET env var for production.');
    return 'dev-jwt-secret-change-me';
  })(),
  siteUrl: process.env.SITE_URL || 'https://nova-pouch.jiun.dev',
  authApiUrl: process.env.AUTH_API_URL || 'https://api.jiun.dev/auth',
};
