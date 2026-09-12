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
 && mkdir -p /out/node_modules/@vp/db \
 && (cp -r packages/db/drizzle /out/node_modules/@vp/db/drizzle || true)

# Production runtime image
FROM node:24-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -r -u 10001 -m appuser

WORKDIR /app
COPY --from=build --chown=appuser:appuser /out /app

USER appuser
ENV NODE_ENV=production PORT=3000 METRICS_PORT=9464 TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
EXPOSE 3000 9464

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
