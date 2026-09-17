# apps/api/Dockerfile
FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
WORKDIR /repo

FROM base AS pruner
# Copy source trees
COPY . .
RUN npx turbo prune --docker @vp/api

FROM base AS build
# Install dependencies
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile

# Build API and dependencies, deploy production bundle
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@vp/api... \
 && pnpm deploy --legacy --filter=@vp/api --prod /out \
 && cp -r packages/db/drizzle /out/drizzle \
 && mkdir -p /out/node_modules/@vp/db \
 && cp -r packages/db/drizzle /out/node_modules/@vp/db/drizzle

# Production runtime image
FROM node:24-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -r -u 10001 -m appuser

WORKDIR /app
COPY --from=build --chown=appuser:appuser /out /app

USER appuser
ENV NODE_ENV=production PORT=3000 METRICS_PORT=9464 TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 NODE_OPTIONS="--import @vp/config/register"
EXPOSE 3000 9464

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
