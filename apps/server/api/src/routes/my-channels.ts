import {
  ADD_ACCOUNT_LIMIT,
  ADD_ACCOUNT_WINDOW,
  createMyChannel,
  listMyIdentities,
  listMySignIns,
  promoteMyChannel,
  recordMySignIn,
} from '@vp/api-contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

/** The account's own channels, identities and sign-ins; none acts as a channel, so none reads `X-Channel-Id`. */
export async function myChannelsRoutes(app: FastifyInstance): Promise<void> {
  const { myChannelsService, accountSecurityService } = app.services;
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  const security = [{ bearerAuth: [] }];

  typedApp.post(
    createMyChannel.path,
    { schema: { ...contractSchema(createMyChannel), security, body: createMyChannel.body } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await myChannelsService.create(requireAuth(request), request.body),
        { status: createMyChannel.status }
      )
  );

  typedApp.patch(
    promoteMyChannel.path,
    {
      schema: {
        ...contractSchema(promoteMyChannel),
        security,
        params: promoteMyChannel.params,
        body: promoteMyChannel.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await myChannelsService.promote(requireAuth(request), request.params.id)
      )
  );

  typedApp.get(
    listMyIdentities.path,
    { schema: { ...contractSchema(listMyIdentities), security } },
    async (request, reply) =>
      sendResult(reply, request, await myChannelsService.identities(requireAuth(request)))
  );

  typedApp.post(
    recordMySignIn.path,
    {
      config: {
        rateLimit: {
          max: ADD_ACCOUNT_LIMIT,
          timeWindow: ADD_ACCOUNT_WINDOW,
          hook: 'preHandler',
          allowList: (request: FastifyRequest) =>
            recordMySignIn.body.safeParse(request.body).data?.added !== true,
        },
      },
      schema: { ...contractSchema(recordMySignIn), security, body: recordMySignIn.body },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await accountSecurityService.recordSignIn(requireAuth(request), {
          slot: request.body.slot,
          userAgent: request.headers['user-agent'],
        }),
        { status: recordMySignIn.status }
      )
  );

  typedApp.get(
    listMySignIns.path,
    { schema: { ...contractSchema(listMySignIns), security, querystring: listMySignIns.query } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await accountSecurityService.signIns(requireAuth(request), request.query)
      )
  );
}
