const nodeEnv = process.env.NODE_ENV || 'development';

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  env: nodeEnv,
  isProduction: nodeEnv === 'production',
  port: parsePort(process.env.PORT, 3000),
  siteUrl: process.env.SITE_URL || 'https://nova-pouch.jiun.dev',
};
