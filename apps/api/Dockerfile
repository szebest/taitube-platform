# apps/api/Dockerfile
FROM node:24-slim AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /repo

# Copy monorepo dependency manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/*/package.json packages/
COPY tools/*/package.json tools/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY . .

# Build API and dependencies, deploy production bundle
RUN pnpm turbo run build --filter=@vp/api... \
 && pnpm deploy --filter=@vp/api --prod /out \
 && cp -r packages/db/drizzle /out/node_modules/@vp/db/drizzle

# Production runtime image
FROM node:24-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tini curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -r -u 10001 -m appuser

WORKDIR /app
COPY --from=build --chown=appuser:appuser /out /app

USER appuser
ENV NODE_ENV=production PORT=3000 METRICS_PORT=9464
EXPOSE 3000 9464

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
