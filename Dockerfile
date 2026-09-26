# The three app images (SDD §12.1): `docker buildx bake` builds the default group, a target at a time with
# `--target api|worker|web`. They share the toolchain and one `pnpm install`; each app then builds from
# its own pruned source, so a change to one app leaves the other two images' layers where they were.
ARG WORKER_RUNTIME=bun

FROM node:24-slim AS toolchain
ARG TURBO_VERSION=2.10.12
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate \
 && npm install --global turbo@${TURBO_VERSION}
ENV npm_config_store_dir=/pnpm/store TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
WORKDIR /repo

FROM toolchain AS pruner
COPY . .
RUN turbo prune @vp/api @vp/worker @vp/web --docker --out-dir out/all \
 && turbo prune @vp/api --docker --out-dir out/api \
 && turbo prune @vp/worker --docker --out-dir out/worker \
 && turbo prune @vp/web --docker --out-dir out/web

FROM toolchain AS deps
COPY --from=pruner /repo/out/all/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build-api
COPY --from=pruner /repo/out/api/full/ .
COPY --from=pruner /repo/scripts/bundle-app.sh /repo/scripts/bundle-entrypoints.ts scripts/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store turbo run build --filter=@vp/api... \
 && sh scripts/bundle-app.sh api /out

FROM deps AS build-worker
COPY --from=pruner /repo/out/worker/full/ .
COPY --from=pruner /repo/scripts/bundle-app.sh /repo/scripts/bundle-entrypoints.ts scripts/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store turbo run build --filter=@vp/worker... \
 && sh scripts/bundle-app.sh worker /out

FROM deps AS build-web
ARG VITE_API_BASE_URL=
COPY --from=pruner /repo/out/web/full/ .
COPY --from=pruner /repo/scripts/bundle-app.sh /repo/scripts/bundle-entrypoints.ts scripts/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store turbo run build --filter=@vp/web... \
 && sh scripts/bundle-app.sh web /out

# CI replaces these three with the bundles it built on the runner (`--build-context api-bundle=<dir>`).
FROM scratch AS api-bundle
COPY --from=build-api /out /

FROM scratch AS worker-bundle
COPY --from=build-worker /out /

FROM scratch AS web-bundle
COPY --from=build-web /out /

# The runtimes run the app, not a package manager: npm and corepack only carry CVEs in here.
FROM node:24-slim AS node-runtime
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends ca-certificates tini curl \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -r -u 10001 -m appuser
WORKDIR /app
ENTRYPOINT ["/usr/bin/tini", "--"]

FROM node-runtime AS api
COPY --from=api-bundle --chown=10001:10001 / /app
USER 10001
ENV NODE_ENV=production PORT=3000 METRICS_PORT=9464
EXPOSE 3000 9464
CMD ["node", "--import", "./dist/instrument.js", "dist/main.js"]

FROM node-runtime AS web
COPY --from=web-bundle / /app
USER 10001
ENV NODE_ENV=production
EXPOSE 5173
ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["node", "--run", "start"]

FROM oven/bun:1.4-slim AS worker-base-bun
FROM node:24-slim AS worker-base-node

FROM worker-base-${WORKER_RUNTIME} AS worker
ARG WORKER_RUNTIME=bun
ENV WORKER_RUNTIME=${WORKER_RUNTIME}
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates tini curl \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && rm -rf /var/lib/apt/lists/* \
 && (id -u 10001 >/dev/null 2>&1 || useradd -r -u 10001 -m appuser) \
 && mkdir -p /tmp/vp && chown -R 10001:10001 /tmp/vp
WORKDIR /app
COPY --from=worker-bundle --chown=10001:10001 / /app
USER 10001
ENV NODE_ENV=production TMPDIR=/tmp/vp WORKER_HEARTBEAT_PATH=/tmp/vp/heartbeat
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "exec ${WORKER_RUNTIME:-bun} --import ./dist/instrument.js dist/main.js"]
