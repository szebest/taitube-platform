import { moderateComment } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function commentModerationRoutes(app: FastifyInstance): Promise<void> {
  const { commentModerationService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    moderateComment.path,
    {
      schema: {
        ...contractSchema(moderateComment),
        params: moderateComment.params,
        body: moderateComment.body,
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(
        reply,
        request,
        await commentModerationService.moderate(user, request.params.id, request.body)
      );
    }
  );
}
