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

# whisper.cpp and its models are pinned in apps/server/worker/assets.lock; a bump is a deliberate commit and
# Renovate does not read the file. The build runs on bookworm, the older libc of the two worker bases, and
# links libstdc++ statically, so one binary runs under both.
FROM node:24-slim AS whisper-build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY apps/server/worker/assets.lock /assets.lock
RUN . /assets.lock \
 && curl -fsSL -o whisper.tar.gz "https://github.com/ggml-org/whisper.cpp/archive/refs/tags/${WHISPER_CPP_TAG}.tar.gz" \
 && echo "${WHISPER_CPP_SHA256}  whisper.tar.gz" | sha256sum -c - \
 && tar -xzf whisper.tar.gz --strip-components=1 \
 && cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF \
      -DWHISPER_BUILD_TESTS=OFF -DCMAKE_EXE_LINKER_FLAGS="-static-libstdc++ -static-libgcc" \
 && cmake --build build --config Release --target whisper-cli -j "$(nproc)" \
 && strip -o /whisper-cli build/bin/whisper-cli

FROM node:24-slim AS captions-models
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/whisper
COPY apps/server/worker/assets.lock /assets.lock
RUN . /assets.lock \
 && curl -fsSL -o ggml-small-q5_1.bin "${CAPTIONS_MODEL_URL}" \
 && curl -fsSL -o ggml-silero-v5.1.2.bin "${CAPTIONS_VAD_MODEL_URL}" \
 && printf '%s  ggml-small-q5_1.bin\n%s  ggml-silero-v5.1.2.bin\n' "${CAPTIONS_MODEL_SHA256}" "${CAPTIONS_VAD_MODEL_SHA256}" | sha256sum -c -

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
COPY --from=whisper-build /whisper-cli /usr/local/bin/whisper-cli
COPY --from=captions-models /opt/whisper /opt/whisper
WORKDIR /app
COPY --from=worker-bundle --chown=10001:10001 / /app
USER 10001
ENV NODE_ENV=production TMPDIR=/tmp/vp WORKER_HEARTBEAT_PATH=/tmp/vp/heartbeat
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "exec ${WORKER_RUNTIME:-bun} --import ./dist/instrument.js dist/main.js"]
