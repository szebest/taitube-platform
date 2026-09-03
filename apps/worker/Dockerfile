ARG WORKER_RUNTIME=bun

FROM node:24-alpine AS node-base
WORKDIR /app
RUN npm i -g pnpm@10.18.3

FROM node-base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vp/worker... build

# Runner stage using Bun or Node based on WORKER_RUNTIME
FROM oven/bun:1.4-alpine AS runner-bun
WORKDIR /app
RUN apk add --no-cache ffmpeg
ENV NODE_ENV=production
COPY --from=builder /app /app
CMD ["bun", "apps/worker/dist/main.js"]

FROM node:24-alpine AS runner-node
WORKDIR /app
RUN apk add --no-cache ffmpeg
ENV NODE_ENV=production
COPY --from=builder /app /app
CMD ["node", "apps/worker/dist/main.js"]

FROM runner-${WORKER_RUNTIME} AS runner
