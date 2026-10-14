import {
  createComment,
  deleteComment,
  listCommentReplies,
  listVideoComments,
  pinComment,
  unpinComment,
  updateComment,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractPaths, contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function commentsRoutes(app: FastifyInstance): Promise<void> {
  const { commentService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  for (const { path, hide } of contractPaths(listVideoComments)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(listVideoComments, { hide }),
          params: listVideoComments.params,
          querystring: listVideoComments.query,
        },
      },
      async (request, reply) =>
        sendResult(
          reply,
          request,
          await commentService.listForVideo(request.user ?? null, request.params.id, request.query)
        )
    );
  }

  for (const { path, hide } of contractPaths(createComment)) {
    server.post(
      path,
      {
        schema: {
          ...contractSchema(createComment, { hide }),
          params: createComment.params,
          body: createComment.body,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        return sendResult(
          reply,
          request,
          await commentService.create(user, request.params.id, request.body),
          { status: 201 }
        );
      }
    );
  }

  for (const { path, hide } of contractPaths(listCommentReplies)) {
    server.get(
      path,
      {
        schema: {
          ...contractSchema(listCommentReplies, { hide }),
          params: listCommentReplies.params,
          querystring: listCommentReplies.query,
        },
      },
      async (request, reply) =>
        sendResult(
          reply,
          request,
          await commentService.listReplies(request.user ?? null, request.params.id, request.query)
        )
    );
  }

  for (const { path, hide } of contractPaths(updateComment)) {
    server.patch(
      path,
      {
        schema: {
          ...contractSchema(updateComment, { hide }),
          params: updateComment.params,
          body: updateComment.body,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        return sendResult(
          reply,
          request,
          await commentService.update(user, request.params.id, request.body.content)
        );
      }
    );
  }

  for (const { path, hide } of contractPaths(deleteComment)) {
    server.delete(
      path,
      {
        schema: {
          ...contractSchema(deleteComment, { hide }),
          params: deleteComment.params,
        },
      },
      async (request, reply) => {
        const user = requireAuth(request);
        return sendResult(reply, request, await commentService.remove(user, request.params.id), {
          status: 204,
        });
      }
    );
  }

  for (const [contract, pinned] of [
    [pinComment, true],
    [unpinComment, false],
  ] as const) {
    for (const { path, hide } of contractPaths(contract)) {
      server.route({
        method: contract.method,
        url: path,
        schema: { ...contractSchema(contract, { hide }), params: contract.params },
        handler: async (request, reply) => {
          const user = requireAuth(request);
          return sendResult(
            reply,
            request,
            await commentService.setPinned(user, request.params.id, pinned)
          );
        },
      });
    }
  }
}
