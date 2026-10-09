import { search, searchSuggestions } from '@vp/api-contracts';
import { SEARCH_RATE_LIMITS } from '@vp/domain';
import { isOk, map } from '@vp/result';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

function perClient(max: number) {
  return {
    rateLimit: {
      max,
      timeWindow: '1 minute',
      keyGenerator: (req: FastifyRequest) => req.user?.id || req.ip,
    },
  };
}

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  const { searchService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    search.path,
    {
      config: perClient(SEARCH_RATE_LIMITS.search),
      schema: { ...contractSchema(search), querystring: search.query },
    },
    async (request, reply) => {
      const found = await searchService.search(request.query);
      if (isOk(found)) reply.header('X-Cache', found.value.cache);
      return sendResult(
        reply,
        request,
        map(found, (page) => page.data)
      );
    }
  );

  server.get(
    searchSuggestions.path,
    {
      config: perClient(SEARCH_RATE_LIMITS.suggestions),
      schema: { ...contractSchema(searchSuggestions), querystring: searchSuggestions.query },
    },
    async (request, reply) =>
      sendResult(reply, request, await searchService.suggest(request.query.q))
  );
}
