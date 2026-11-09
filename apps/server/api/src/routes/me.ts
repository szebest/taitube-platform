import { getAccount, issueChannelImageUpload, updateMyChannel } from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel, requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function meRoutes(app: FastifyInstance): Promise<void> {
  const { channelService, channelImageService } = app.services;

  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    getAccount.path,
    {
      schema: {
        ...contractSchema(getAccount),
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      return sendResult(reply, request, await channelService.getAccount(requireAuth(request)));
    }
  );

  typedApp.patch(
    updateMyChannel.path,
    {
      schema: {
        ...contractSchema(updateMyChannel),
        security: [{ bearerAuth: [] }],
        body: updateMyChannel.body,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelService.updateChannel(user, acting, request.body)
      );
    }
  );

  typedApp.post(
    issueChannelImageUpload.path,
    {
      schema: {
        ...contractSchema(issueChannelImageUpload),
        security: [{ bearerAuth: [] }],
        body: issueChannelImageUpload.body,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelImageService.issueUpload(user, acting, request.body),
        { status: 201 }
      );
    }
  );
}
