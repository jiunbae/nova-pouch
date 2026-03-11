import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from 'hono/bun';
import { config } from './config';
import { connectMongo, closeMongo } from './db/mongo';
import { corsMiddleware } from './middleware/cors';
import { healthRoutes } from './routes/health';
import { recordRoutes } from './routes/records';
import { ogRoutes, preWarmFont } from './routes/og';

const app = new Hono();

// Security headers
app.use('*', secureHeaders());

// CORS for API routes
app.use('/api/*', corsMiddleware);

// Health check
app.route('/', healthRoutes);

// API routes
app.route('/api', recordRoutes);
app.route('/api', ogRoutes);

// Static files (Vite build output)
app.use('/*', serveStatic({ root: './dist' }));

// SPA fallback: serve index.html for unmatched routes
app.use('/*', serveStatic({ root: './dist', path: 'index.html' }));

async function main() {
  await connectMongo();
  preWarmFont();
  console.log(`nova-pouch server listening on port ${config.port}`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

const gracefulShutdown = async () => {
  console.log('Shutting down...');
  await closeMongo();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default {
  port: config.port,
  fetch: app.fetch,
};
