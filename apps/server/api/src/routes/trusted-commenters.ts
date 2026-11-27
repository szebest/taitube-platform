import { listTrustedCommenters, trustCommenter, untrustCommenter } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function trustedCommentersRoutes(app: FastifyInstance): Promise<void> {
  const { trustedCommenterService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listTrustedCommenters.path,
    {
      schema: {
        ...contractSchema(listTrustedCommenters),
        querystring: listTrustedCommenters.query,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await trustedCommenterService.list(user, acting, request.query)
      );
    }
  );

  server.put(
    trustCommenter.path,
    { schema: { ...contractSchema(trustCommenter), params: trustCommenter.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await trustedCommenterService.trust(user, acting, request.params.userId),
        { status: 204 }
      );
    }
  );

  server.delete(
    untrustCommenter.path,
    { schema: { ...contractSchema(untrustCommenter), params: untrustCommenter.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await trustedCommenterService.untrust(user, acting, request.params.userId),
        { status: 204 }
      );
    }
  );
}
