import {
  createPost,
  deletePost,
  getCommunityFeed,
  getPost,
  likePost,
  listChannelPosts,
  unlikePost,
  updatePost,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel, requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function postsRoutes(app: FastifyInstance): Promise<void> {
  const { postService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listChannelPosts.path,
    {
      schema: {
        ...contractSchema(listChannelPosts),
        params: listChannelPosts.params,
        querystring: listChannelPosts.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await postService.listByChannel(
          request.user ?? null,
          request.params.idOrHandle,
          request.query
        )
      )
  );

  server.get(
    getPost.path,
    { schema: { ...contractSchema(getPost), params: getPost.params } },
    async (request, reply) =>
      sendResult(reply, request, await postService.get(request.user ?? null, request.params.id))
  );

  server.post(
    createPost.path,
    { schema: { ...contractSchema(createPost), body: createPost.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await postService.create(user, acting, request.body), {
        status: createPost.status,
      });
    }
  );

  server.patch(
    updatePost.path,
    {
      schema: { ...contractSchema(updatePost), params: updatePost.params, body: updatePost.body },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await postService.edit(user, acting, request.params.id, request.body)
      );
    }
  );

  server.delete(
    deletePost.path,
    { schema: { ...contractSchema(deletePost), params: deletePost.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await postService.remove(user, acting, request.params.id), {
        status: deletePost.status,
      });
    }
  );

  for (const [contract, liked] of [
    [likePost, true],
    [unlikePost, false],
  ] as const) {
    server.route({
      method: contract.method,
      url: contract.path,
      schema: { ...contractSchema(contract), params: contract.params },
      handler: async (request, reply) => {
        const user = requireAuth(request);
        return sendResult(
          reply,
          request,
          await postService.setLiked(user, request.params.id, liked)
        );
      },
    });
  }

  server.get(
    getCommunityFeed.path,
    { schema: { ...contractSchema(getCommunityFeed), querystring: getCommunityFeed.query } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await postService.communityFeed(user, acting, request.query)
      );
    }
  );
}
