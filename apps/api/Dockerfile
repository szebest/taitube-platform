# apps/api/Dockerfile
FROM node:24-slim AS base
ARG TURBO_VERSION=2.10.12
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate \
 && npm install --global turbo@${TURBO_VERSION}
ENV npm_config_store_dir=/pnpm/store
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN turbo prune --docker @vp/api

FROM base AS build
COPY --from=pruner /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

COPY --from=pruner /repo/out/full/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store turbo run build --filter=@vp/api... \
 && pnpm deploy --legacy --filter=@vp/api --prod /out \
 && cp -r packages/server/db/drizzle /out/drizzle \
 && mkdir -p /out/node_modules/@vp/db \
 && cp -r packages/server/db/drizzle /out/node_modules/@vp/db/drizzle

FROM node:24-slim AS runtime
# The runtime runs the app, not a package manager: npm and corepack only carry CVEs in here.
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends ca-certificates tini curl \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -r -u 10001 -m appuser

WORKDIR /app
COPY --from=build --chown=appuser:appuser /out /app

USER appuser
ENV NODE_ENV=production PORT=3000 METRICS_PORT=9464 TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 NODE_OPTIONS="--import @vp/config/register"
EXPOSE 3000 9464

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--import", "./dist/instrument.js", "dist/main.js"]
