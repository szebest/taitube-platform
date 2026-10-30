import { getCurrentPick } from '@vp/api-contracts';
import { isErr } from '@vp/result';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function picksRoutes(app: FastifyInstance): Promise<void> {
  const { currentPickService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getCurrentPick.path,
    {
      schema: contractSchema(getCurrentPick, {
        responses: { 304: z.undefined().describe('Not Modified') },
      }),
    },
    async (request, reply) => {
      const page = await currentPickService.current(request.headers['if-none-match']);
      if (isErr(page)) return sendResult(reply, request, page);

      reply.headers(page.value.headers);
      return page.value.notModified
        ? reply.status(304).send()
        : reply.status(200).send(page.value.data);
    }
  );
}
