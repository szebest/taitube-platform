import { getCommentSettings, updateCommentSettings } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function commentSettingsRoutes(app: FastifyInstance): Promise<void> {
  const { commentSettingsService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getCommentSettings.path,
    { schema: contractSchema(getCommentSettings) },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await commentSettingsService.get(user, acting));
    }
  );

  server.put(
    updateCommentSettings.path,
    { schema: { ...contractSchema(updateCommentSettings), body: updateCommentSettings.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await commentSettingsService.update(user, acting, request.body)
      );
    }
  );
}
