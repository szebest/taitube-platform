import { search, searchSuggestions } from '@vp/api-contracts';
import { isOk, map } from '@vp/result';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  const { searchService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    search.path,
    { schema: { ...contractSchema(search), querystring: search.query } },
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
    { schema: { ...contractSchema(searchSuggestions), querystring: searchSuggestions.query } },
    async (request, reply) =>
      sendResult(reply, request, await searchService.suggest(request.query.q))
  );
}
