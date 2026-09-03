FROM node:24-alpine AS base
WORKDIR /app
RUN npm i -g pnpm@10.18.3

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vp/api... build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app
EXPOSE 3000 9464
CMD ["node", "apps/api/dist/main.js"]
