import crypto from 'node:crypto';
import { type FeedResponse, getFeed } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Singleflight } from '../services/singleflight';
import type { VideoService } from '../services/video-service';
import { contractSchema } from './contract-schema';

export interface FeedRouteOptions {
  videoService: VideoService;
  cache?: CacheClient;
}

/**
 * Fastify routes plugin for public video feed (PRD US-12, FR-14, SDD §6.1).
 * Features:
 * - Unauthenticated global public browse
 * - Multi-sort (recent, popular, trending) & categoryId filtering
 * - Redis feed caching for first page (30s TTL + stale-while-revalidate)
 * - Singleflight promise coalescing
 * - HTTP ETag / 304 Not Modified
 */
export function registerFeedRoutes(app: FastifyInstance, options: FeedRouteOptions): void {
  const { videoService, cache } = options;
  const singleflight = new Singleflight();

  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const path of ['/v1/feed', '/feed'] as const) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getFeed, {
            hide: path === '/feed',
            responses: { 304: z.undefined().describe('Not Modified') },
          }),
          querystring: getFeed.query,
        },
      },
      async (request, reply) => {
        const { sort = 'recent', categoryId, cursor, limit = 20 } = request.query;
        const ifNoneMatch = request.headers['if-none-match'];
        const isFirstPage = !cursor;
        const cacheKey = `taitube:feed:public:${sort}:${categoryId || 'all'}`;

        if (isFirstPage && cache) {
          try {
            const cachedJson = await cache.get(cacheKey);
            if (cachedJson) {
              const cached = JSON.parse(cachedJson) as {
                data: FeedResponse;
                etag: string;
              };

              if (
                ifNoneMatch &&
                (ifNoneMatch === cached.etag || ifNoneMatch === cached.etag.replace(/^W\//, ''))
              ) {
                reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
                reply.header('ETag', cached.etag);
                return reply.status(304).send();
              }

              reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
              reply.header('ETag', cached.etag);
              return reply.status(200).send(cached.data);
            }
          } catch {
            // Cache lookup error falls through to singleflight fetch
          }
        }

        const sfKey = `feed:${sort}:${categoryId || 'all'}:${cursor || 'first'}:${limit}`;
        const data = await singleflight.do(sfKey, () =>
          videoService.listPublic({
            sort,
            categoryId,
            cursor,
            limit,
          })
        );

        const serialized = JSON.stringify(data);
        const hash = crypto.createHash('sha1').update(serialized).digest('hex');
        const etag = `W/"${hash}"`;

        if (isFirstPage && cache) {
          try {
            await cache.set(cacheKey, JSON.stringify({ data, etag }), 30);
          } catch {
            // Non-blocking cache store error
          }
        }

        if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === hash)) {
          reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
          reply.header('ETag', etag);
          return reply.status(304).send();
        }

        reply.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
        reply.header('ETag', etag);
        return reply.status(200).send(data);
      }
    );
  }
}
