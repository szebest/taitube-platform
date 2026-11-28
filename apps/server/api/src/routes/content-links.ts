import { map } from '@kit/result';
import {
  acceptContentLinkSuggestion,
  approveContentLink,
  createContentLink,
  declineContentLink,
  getContentLinkStats,
  getLinkPolicy,
  listCreatorContentLinks,
  lookupContentLinks,
  removeContentLink,
  setLinkPolicy,
  suggestContentLink,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel, requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function contentLinksRoutes(app: FastifyInstance): Promise<void> {
  const { contentLinkService, contentLinkReads } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    lookupContentLinks.path,
    { schema: { ...contractSchema(lookupContentLinks), body: lookupContentLinks.body } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        map(await contentLinkReads.forItems(request.body.refs, request.user ?? null), (items) => ({
          items,
        }))
      )
  );

  server.post(
    createContentLink.path,
    { schema: { ...contractSchema(createContentLink), body: createContentLink.body } },
    async (request, reply) => {
      const { user } = requireActingChannel(request);
      return sendResult(reply, request, await contentLinkService.create(user, request.body), {
        status: createContentLink.status,
      });
    }
  );

  server.post(
    suggestContentLink.path,
    { schema: { ...contractSchema(suggestContentLink), body: suggestContentLink.body } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        map(await contentLinkService.suggest(requireAuth(request), request.body), () => ({
          accepted: true as const,
        })),
        { status: suggestContentLink.status }
      )
  );

  server.post(
    approveContentLink.path,
    { schema: { ...contractSchema(approveContentLink), params: approveContentLink.params } },
    async (request, reply) => {
      const { user } = requireActingChannel(request);
      return sendResult(reply, request, await contentLinkService.approve(user, request.params.id));
    }
  );

  server.post(
    declineContentLink.path,
    { schema: { ...contractSchema(declineContentLink), params: declineContentLink.params } },
    async (request, reply) => {
      const { user } = requireActingChannel(request);
      return sendResult(reply, request, await contentLinkService.decline(user, request.params.id));
    }
  );

  server.post(
    acceptContentLinkSuggestion.path,
    {
      schema: {
        ...contractSchema(acceptContentLinkSuggestion),
        params: acceptContentLinkSuggestion.params,
      },
    },
    async (request, reply) => {
      const { user } = requireActingChannel(request);
      return sendResult(reply, request, await contentLinkService.accept(user, request.params.id));
    }
  );

  server.delete(
    removeContentLink.path,
    { schema: { ...contractSchema(removeContentLink), params: removeContentLink.params } },
    async (request, reply) => {
      const { user } = requireActingChannel(request);
      return sendResult(reply, request, await contentLinkService.remove(user, request.params.id), {
        status: removeContentLink.status,
      });
    }
  );

  server.get(
    listCreatorContentLinks.path,
    {
      schema: {
        ...contractSchema(listCreatorContentLinks),
        querystring: listCreatorContentLinks.query,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        map(await contentLinkService.list(user, acting, request.query.view), (items) => ({ items }))
      );
    }
  );

  server.get(
    getContentLinkStats.path,
    { schema: contractSchema(getContentLinkStats) },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        map(await contentLinkService.stats(user, acting), (items) => ({ items }))
      );
    }
  );

  server.get(
    getLinkPolicy.path,
    { schema: contractSchema(getLinkPolicy) },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        map(await contentLinkService.policy(user, acting), (policy) => ({ policy }))
      );
    }
  );

  server.put(
    setLinkPolicy.path,
    { schema: { ...contractSchema(setLinkPolicy), body: setLinkPolicy.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        map(await contentLinkService.setPolicy(user, acting, request.body.policy), (policy) => ({
          policy,
        }))
      );
    }
  );
}
