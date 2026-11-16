import {
  createChannelExport,
  deleteChannelExport,
  getChannelExport,
  listChannelExports,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function channelExportRoutes(app: FastifyInstance): Promise<void> {
  const { channelExportService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    createChannelExport.path,
    { schema: { ...contractSchema(createChannelExport), body: createChannelExport.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelExportService.create(user, acting, request.body),
        {
          status: createChannelExport.status,
        }
      );
    }
  );

  server.get(
    listChannelExports.path,
    { schema: { ...contractSchema(listChannelExports), querystring: listChannelExports.query } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelExportService.list(user, acting, request.query)
      );
    }
  );

  server.get(
    getChannelExport.path,
    { schema: { ...contractSchema(getChannelExport), params: getChannelExport.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelExportService.get(user, acting, request.params.id)
      );
    }
  );

  server.delete(
    deleteChannelExport.path,
    { schema: { ...contractSchema(deleteChannelExport), params: deleteChannelExport.params } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      const removed = await channelExportService.remove(user, acting, request.params.id);
      return sendResult(reply, request, removed, { status: deleteChannelExport.status });
    }
  );
}
