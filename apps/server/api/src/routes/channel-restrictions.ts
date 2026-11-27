import {
  getOwnRestriction,
  liftRestriction,
  listRestrictions,
  restrictUser,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel, requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function channelRestrictionsRoutes(app: FastifyInstance): Promise<void> {
  const { channelRestrictionService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listRestrictions.path,
    { schema: { ...contractSchema(listRestrictions), querystring: listRestrictions.query } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelRestrictionService.list(user, acting, request.query)
      );
    }
  );

  server.put(
    restrictUser.path,
    {
      schema: {
        ...contractSchema(restrictUser),
        params: restrictUser.params,
        body: restrictUser.body,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelRestrictionService.restrict(user, acting, request.params.userId, request.body)
      );
    }
  );

  server.delete(
    liftRestriction.path,
    { schema: { ...contractSchema(liftRestriction), params: liftRestriction.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelRestrictionService.lift(user, acting, request.params.userId),
        { status: 204 }
      );
    }
  );

  server.get(
    getOwnRestriction.path,
    { schema: { ...contractSchema(getOwnRestriction), params: getOwnRestriction.params } },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(
        reply,
        request,
        await channelRestrictionService.ownBan(user, request.params.id)
      );
    }
  );
}
