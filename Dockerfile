# The four app images (SDD §12.1): `docker buildx bake` builds the default group, a target at a time with
# `--target api|worker|web|studio`. They share the toolchain and one `pnpm install`; each app then builds
# from its own pruned source, so a change to one app leaves the other images' layers where they were.
ARG WORKER_RUNTIME=bun

FROM node:24-slim AS toolchain
ARG TURBO_VERSION=2.11.7
WORKDIR /repo
COPY package.json .
RUN corepack enable && corepack install \
 && npm install --global turbo@${TURBO_VERSION}
ENV pnpm_config_store_dir=/pnpm/store TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1

FROM toolchain AS pruner
COPY . .
RUN turbo prune @vp/api @vp/worker @vp/web @vp/studio --docker --out-dir out/all \
 && turbo prune @vp/api --docker --out-dir out/api \
 && turbo prune @vp/worker --docker --out-dir out/worker \
 && turbo prune @vp/web --docker --out-dir out/web \
 && turbo prune @vp/studio --docker --out-dir out/studio

FROM toolchain AS deps
COPY --from=pruner /repo/out/all/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build-api
COPY --from=pruner /repo/out/api/full/ .
COPY --from=pruner /repo/scripts/bundle-app.sh /repo/scripts/bundle-entrypoints.ts scripts/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store --mount=type=cache,id=turbo-cache,target=/repo/.turbo/cache \
    turbo run build --filter=@vp/api... \
 && sh scripts/bundle-app.sh api /out

FROM deps AS build-worker
COPY --from=pruner /repo/out/worker/full/ .
COPY --from=pruner /repo/scripts/bundle-app.sh /repo/scripts/bundle-entrypoints.ts scripts/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store --mount=type=cache,id=turbo-cache,target=/repo/.turbo/cache \
    turbo run build --filter=@vp/worker... \
 && sh scripts/bundle-app.sh worker /out

FROM deps AS build-web
ARG VITE_API_BASE_URL=
ARG VITE_OTEL_TRACES_URL=
COPY --from=pruner /repo/out/web/full/ .
COPY --from=pruner /repo/scripts/bundle-app.sh /repo/scripts/import-bundle.ts scripts/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store --mount=type=cache,id=turbo-cache,target=/repo/.turbo/cache \
    turbo run build --filter=@vp/web... \
 && sh scripts/bundle-app.sh web /out

FROM deps AS build-studio
ARG VITE_API_BASE_URL=
ARG VITE_OTEL_TRACES_URL=
COPY --from=pruner /repo/out/studio/full/ .
COPY --from=pruner /repo/scripts/bundle-app.sh /repo/scripts/import-bundle.ts scripts/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store --mount=type=cache,id=turbo-cache,target=/repo/.turbo/cache \
    turbo run build --filter=@vp/studio... \
 && sh scripts/bundle-app.sh studio /out

# CI replaces these with the bundles it built on the runner (`--build-context api-bundle=<dir>`).
FROM scratch AS api-bundle
COPY --from=build-api /out /

FROM scratch AS worker-bundle
COPY --from=build-worker /out /

FROM scratch AS web-bundle
COPY --from=build-web /out /

FROM scratch AS studio-bundle
COPY --from=build-studio /out /

# The runtimes run the app, not a package manager: npm, corepack and yarn only carry CVEs in here.
FROM node:24-slim AS node-runtime
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends ca-certificates tini curl \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
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

FROM node-runtime AS client-runtime
USER 10001
ENV NODE_ENV=production
ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["node", "--run", "start"]

FROM client-runtime AS web
COPY --from=web-bundle / /app
EXPOSE 5173

FROM client-runtime AS studio
COPY --from=studio-bundle / /app
EXPOSE 5174

FROM oven/bun:1.4-slim AS worker-base-bun
FROM node:24-slim AS worker-base-node

FROM worker-base-${WORKER_RUNTIME:-bun} AS worker
ARG WORKER_RUNTIME=bun
ENV WORKER_RUNTIME=${WORKER_RUNTIME}
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates tini curl \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
 && rm -rf /var/lib/apt/lists/* \
 && (id -u 10001 >/dev/null 2>&1 || useradd -r -u 10001 -m appuser) \
 && mkdir -p /tmp/vp && chown -R 10001:10001 /tmp/vp
WORKDIR /app
COPY --from=worker-bundle --chown=10001:10001 / /app
USER 10001
ENV NODE_ENV=production TMPDIR=/tmp/vp WORKER_HEARTBEAT_PATH=/tmp/vp/heartbeat
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "exec ${WORKER_RUNTIME:-bun} --import ./dist/instrument.js dist/main.js"]
