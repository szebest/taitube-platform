import { getFeed } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { FeedService } from '../services/feed-service';
import { contractSchema } from './contract-schema';

export interface FeedRouteOptions {
  feedService: FeedService;
}

/**
 * Fastify routes plugin for the public video feed (PRD US-12, FR-14, SDD §6.1).
 * Thin transport adapter delegating caching and conditional evaluation to FeedService.
 */
export function registerFeedRoutes(app: FastifyInstance, options: FeedRouteOptions): void {
  const { feedService } = options;
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
        const page = await feedService.getFeed(request.query, request.headers['if-none-match']);
        reply.headers(page.headers);
        return page.notModified ? reply.status(304).send() : reply.status(200).send(page.data);
      }
    );
  }
}
