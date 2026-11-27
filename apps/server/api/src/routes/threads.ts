import {
  createThreadComment,
  createVideoThread,
  getThread,
  listThreadComments,
  listVideoThreads,
  pinThread,
  removeThread,
  unpinThread,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel, requireAuth } from '../plugins/auth';
import { commentFailureHeaders, presentCommentFailure } from './comments.presenter';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function threadsRoutes(app: FastifyInstance): Promise<void> {
  const { threadService, commentService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listVideoThreads.path,
    { schema: { ...contractSchema(listVideoThreads), params: listVideoThreads.params } },
    async (request, reply) =>
      sendResult(reply, request, await threadService.list(request.user ?? null, request.params.id))
  );

  server.post(
    createVideoThread.path,
    {
      schema: {
        ...contractSchema(createVideoThread),
        params: createVideoThread.params,
        body: createVideoThread.body,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await threadService.create(user, acting, request.params.id, request.body),
        {
          status: createVideoThread.status,
          present: (failure) => presentCommentFailure(failure, request.url),
          headers: commentFailureHeaders,
        }
      );
    }
  );

  server.get(
    getThread.path,
    { schema: { ...contractSchema(getThread), params: getThread.params } },
    async (request, reply) =>
      sendResult(reply, request, await threadService.get(request.user ?? null, request.params.id))
  );

  server.get(
    listThreadComments.path,
    {
      schema: {
        ...contractSchema(listThreadComments),
        params: listThreadComments.params,
        querystring: listThreadComments.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await commentService.list(
          request.user ?? null,
          { type: 'thread', id: request.params.id },
          request.query
        )
      )
  );

  server.post(
    createThreadComment.path,
    {
      schema: {
        ...contractSchema(createThreadComment),
        params: createThreadComment.params,
        body: createThreadComment.body,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await commentService.create(
          user,
          acting,
          { type: 'thread', id: request.params.id },
          request.body
        ),
        {
          status: createThreadComment.status,
          present: (failure) => presentCommentFailure(failure, request.url),
          headers: commentFailureHeaders,
        }
      );
    }
  );

  for (const [contract, pinned] of [
    [pinThread, true],
    [unpinThread, false],
  ] as const) {
    server.route({
      method: contract.method,
      url: contract.path,
      schema: { ...contractSchema(contract), params: contract.params },
      handler: async (request, reply) =>
        sendResult(
          reply,
          request,
          await threadService.setPinned(requireAuth(request), request.params.id, pinned)
        ),
    });
  }

  server.post(
    removeThread.path,
    {
      schema: {
        ...contractSchema(removeThread),
        params: removeThread.params,
        body: removeThread.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await threadService.remove(requireAuth(request), request.params.id, request.body),
        { status: removeThread.status }
      )
  );
}
