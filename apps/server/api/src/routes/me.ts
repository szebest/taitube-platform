import {
  completeChannelImage,
  getAccount,
  getMyChannel,
  getMySpotlight,
  prepareChannelImage,
  setMySpotlight,
  updateMyChannel,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel, requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function meRoutes(app: FastifyInstance): Promise<void> {
  const { channelService, channelImagePipelineService, channelSpotlightService } = app.services;

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

  typedApp.get(
    getMyChannel.path,
    { schema: { ...contractSchema(getMyChannel), security: [{ bearerAuth: [] }] } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await channelService.getOwnerChannel(user, acting));
    }
  );

  typedApp.post(
    prepareChannelImage.path,
    {
      schema: {
        ...contractSchema(prepareChannelImage),
        security: [{ bearerAuth: [] }],
        params: prepareChannelImage.params,
        body: prepareChannelImage.body,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelImagePipelineService.prepare(user, acting, {
          kind: request.params.kind,
          ...request.body,
        }),
        { status: prepareChannelImage.status }
      );
    }
  );

  typedApp.post(
    completeChannelImage.path,
    {
      schema: {
        ...contractSchema(completeChannelImage),
        security: [{ bearerAuth: [] }],
        params: completeChannelImage.params,
        body: completeChannelImage.body,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelImagePipelineService.complete(user, acting, request.params.kind, request.body),
        { status: completeChannelImage.status }
      );
    }
  );

  typedApp.get(
    getMySpotlight.path,
    { schema: { ...contractSchema(getMySpotlight), security: [{ bearerAuth: [] }] } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await channelSpotlightService.getSettings(user, acting));
    }
  );

  typedApp.put(
    setMySpotlight.path,
    {
      schema: {
        ...contractSchema(setMySpotlight),
        security: [{ bearerAuth: [] }],
        body: setMySpotlight.body,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelSpotlightService.replace(user, acting, request.body)
      );
    }
  );
}
