import {
  createSavedReply,
  deleteSavedReply,
  listSavedReplies,
  updateSavedReply,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function savedRepliesRoutes(app: FastifyInstance): Promise<void> {
  const { savedReplyService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listSavedReplies.path,
    { schema: contractSchema(listSavedReplies) },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await savedReplyService.list(user, acting));
    }
  );

  server.post(
    createSavedReply.path,
    { schema: { ...contractSchema(createSavedReply), body: createSavedReply.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await savedReplyService.create(user, acting, request.body),
        { status: 201 }
      );
    }
  );

  server.patch(
    updateSavedReply.path,
    {
      schema: {
        ...contractSchema(updateSavedReply),
        params: updateSavedReply.params,
        body: updateSavedReply.body,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await savedReplyService.update(user, acting, request.params.id, request.body)
      );
    }
  );

  server.delete(
    deleteSavedReply.path,
    { schema: { ...contractSchema(deleteSavedReply), params: deleteSavedReply.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await savedReplyService.remove(user, acting, request.params.id),
        { status: 204 }
      );
    }
  );
}
