# apps/worker/Dockerfile (SDD §12.1)
ARG WORKER_RUNTIME=bun

FROM node:24-slim AS build
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
WORKDIR /repo

# Copy source trees
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build worker and dependencies, deploy production bundle
RUN pnpm turbo run build --filter=@vp/worker... \
 && pnpm deploy --legacy --filter=@vp/worker --prod /out \
 && cp -r packages/db/drizzle /out/drizzle \
 && mkdir -p /out/node_modules/@vp/db \
 && cp -r packages/db/drizzle /out/node_modules/@vp/db/drizzle

# Base runtime choices
FROM oven/bun:1.4-slim AS runtime-bun
FROM node:24-slim AS runtime-node

# Selected runtime target
FROM runtime-${WORKER_RUNTIME} AS runtime
ARG WORKER_RUNTIME=bun
ENV WORKER_RUNTIME=${WORKER_RUNTIME}

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates tini curl \
 && rm -rf /var/lib/apt/lists/* \
 && (id -u 10001 >/dev/null 2>&1 || useradd -r -u 10001 -m appuser) \
 && mkdir -p /tmp/vp && chown -R 10001:10001 /tmp/vp

WORKDIR /app
COPY --from=build --chown=10001:10001 /out /app

USER 10001
ENV NODE_ENV=production TMPDIR=/tmp/vp WORKER_HEARTBEAT_PATH=/tmp/vp/heartbeat TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 NODE_OPTIONS="--experimental-specifier-resolution=node"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "exec ${WORKER_RUNTIME:-bun} dist/main.js"]
