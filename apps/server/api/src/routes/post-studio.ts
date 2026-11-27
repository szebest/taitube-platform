import {
  getPostStats,
  listManagedPosts,
  pinPost,
  recordPostOpen,
  recordPostShareClick,
  unpinPost,
  votePost,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel, requireAuth } from '../plugins/auth';
import { presentBanned } from './comments.presenter';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function postStudioRoutes(app: FastifyInstance): Promise<void> {
  const { postManageService, postEngagementService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listManagedPosts.path,
    { schema: { ...contractSchema(listManagedPosts), querystring: listManagedPosts.query } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await postManageService.list(user, acting, request.query));
    }
  );

  server.get(
    getPostStats.path,
    { schema: { ...contractSchema(getPostStats), params: getPostStats.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await postManageService.stats(user, acting, request.params.id)
      );
    }
  );

  server.post(
    pinPost.path,
    { schema: { ...contractSchema(pinPost), params: pinPost.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await postManageService.pin(user, acting, request.params.id)
      );
    }
  );

  server.delete(
    unpinPost.path,
    { schema: { ...contractSchema(unpinPost), params: unpinPost.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await postManageService.unpin(user, acting, request.params.id)
      );
    }
  );

  server.put(
    votePost.path,
    {
      schema: { ...contractSchema(votePost), params: votePost.params, body: votePost.body },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(
        reply,
        request,
        await postEngagementService.vote(user, request.params.id, request.body.optionIndex),
        { on: { COMMENTS_BANNED: (failure) => presentBanned(failure, request.url) } }
      );
    }
  );

  server.post(
    recordPostOpen.path,
    { schema: { ...contractSchema(recordPostOpen), params: recordPostOpen.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await postEngagementService.recordOpen(request.user ?? null, request.ip, request.params.id),
        { status: recordPostOpen.status }
      )
  );

  server.post(
    recordPostShareClick.path,
    { schema: { ...contractSchema(recordPostShareClick), params: recordPostShareClick.params } },
    async (request, reply) =>
      sendResult(reply, request, await postEngagementService.recordShareClick(request.params.id), {
        status: recordPostShareClick.status,
      })
  );
}
