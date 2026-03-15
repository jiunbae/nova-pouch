FROM registry.jiun.dev/oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Build frontend (Vite)
COPY index.html vite.config.ts tsconfig.json ./
COPY src/ ./src/
COPY css/ ./css/
COPY assets/ ./assets/
RUN bun run build

# Build server
COPY server/ ./server/
RUN bun run build:server

FROM registry.jiun.dev/oven/bun:1-alpine AS runner
WORKDIR /app
COPY --from=base /app/server-dist ./server-dist
COPY --from=base /app/dist ./dist
COPY --from=base /app/package.json ./
# Only install production dependencies (native modules like @resvg/resvg-js)
COPY --from=base /app/bun.lock* ./
RUN bun install --frozen-lockfile --production
USER bun
EXPOSE 3000
CMD ["bun", "run", "server-dist/index.js"]
