import { createApiToken, listApiTokens, revokeApiToken } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel, requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function apiTokenRoutes(app: FastifyInstance): Promise<void> {
  const { apiTokenService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    createApiToken.path,
    { schema: { ...contractSchema(createApiToken), body: createApiToken.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await apiTokenService.create(user, acting, request.body), {
        status: createApiToken.status,
      });
    }
  );

  server.get(
    listApiTokens.path,
    { schema: contractSchema(listApiTokens) },
    async (request, reply) =>
      sendResult(reply, request, await apiTokenService.list(requireAuth(request)))
  );

  server.delete(
    revokeApiToken.path,
    { schema: { ...contractSchema(revokeApiToken), params: revokeApiToken.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await apiTokenService.revoke(requireAuth(request), request.params.id),
        { status: revokeApiToken.status }
      )
  );
}
