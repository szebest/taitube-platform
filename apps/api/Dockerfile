# apps/api/Dockerfile
FROM node:24-slim AS build
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
WORKDIR /repo

# Copy source trees
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build API and dependencies, deploy production bundle
RUN pnpm turbo run build --filter=@vp/api... \
 && pnpm deploy --legacy --filter=@vp/api --prod /out \
 && cp -r packages/db/drizzle /out/drizzle \
 && mkdir -p /out/node_modules/@vp/db \
 && cp -r packages/db/drizzle /out/node_modules/@vp/db/drizzle \
 && cp apps/api/loader.mjs /out/loader.mjs \
 && cp apps/api/register.js /out/register.js

# Production runtime image
FROM node:24-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -r -u 10001 -m appuser

WORKDIR /app
COPY --from=build --chown=appuser:appuser /out /app

USER appuser
ENV NODE_ENV=production PORT=3000 METRICS_PORT=9464 TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 NODE_OPTIONS="--import=/app/register.js"
EXPOSE 3000 9464

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
