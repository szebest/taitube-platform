import { getFeed } from '@vp/api-contracts';
import { isErr } from '@vp/result';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function feedRoutes(app: FastifyInstance): Promise<void> {
  const { feedService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(getFeed)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(getFeed, {
            hide,
            responses: { 304: z.undefined().describe('Not Modified') },
          }),
          querystring: getFeed.query,
        },
      },
      async (request, reply) => {
        const page = await feedService.getFeed(request.query, request.headers['if-none-match']);
        if (isErr(page)) return sendResult(reply, request, page);

        reply.headers(page.value.headers);
        return page.value.notModified
          ? reply.status(304).send()
          : reply.status(200).send(page.value.data);
      }
    );
  }
}
