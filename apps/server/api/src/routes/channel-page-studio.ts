import {
  cancelChannelPageSchedule,
  getChannelPageDraft,
  listChannelPageRevisions,
  listChannelPageSchedules,
  previewChannelPage,
  publishChannelPage,
  restoreChannelPageRevision,
  saveChannelPageDraft,
  scheduleChannelPage,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel } from '../plugins/auth';
import { localeChainOf } from '../services/locale-chain';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function channelPageStudioRoutes(app: FastifyInstance): Promise<void> {
  const { channelLayoutService, channelLayoutScheduleService, channelPageService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getChannelPageDraft.path,
    { schema: contractSchema(getChannelPageDraft) },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await channelLayoutService.getDraft(user, acting));
    }
  );

  server.put(
    saveChannelPageDraft.path,
    { schema: { ...contractSchema(saveChannelPageDraft), body: saveChannelPageDraft.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelLayoutService.saveDraft(user, acting, request.body)
      );
    }
  );

  server.post(
    publishChannelPage.path,
    { schema: { ...contractSchema(publishChannelPage), body: publishChannelPage.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelLayoutService.publish(user, acting, request.body)
      );
    }
  );

  server.get(
    listChannelPageSchedules.path,
    { schema: contractSchema(listChannelPageSchedules) },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(reply, request, await channelLayoutScheduleService.list(user, acting));
    }
  );

  server.post(
    scheduleChannelPage.path,
    { schema: { ...contractSchema(scheduleChannelPage), body: scheduleChannelPage.body } },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      const { publishAt, source } = request.body;
      return sendResult(
        reply,
        request,
        await channelLayoutScheduleService.create(user, acting, {
          publishAt: new Date(publishAt),
          source,
        }),
        { status: scheduleChannelPage.status }
      );
    }
  );

  server.delete(
    cancelChannelPageSchedule.path,
    {
      schema: {
        ...contractSchema(cancelChannelPageSchedule),
        params: cancelChannelPageSchedule.params,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelLayoutScheduleService.cancel(user, acting, request.params.id)
      );
    }
  );

  server.get(
    listChannelPageRevisions.path,
    {
      schema: {
        ...contractSchema(listChannelPageRevisions),
        querystring: listChannelPageRevisions.query,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelLayoutService.listRevisions(user, acting, request.query)
      );
    }
  );

  server.post(
    restoreChannelPageRevision.path,
    {
      schema: {
        ...contractSchema(restoreChannelPageRevision),
        params: restoreChannelPageRevision.params,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await channelLayoutService.restore(user, acting, request.params.id)
      );
    }
  );

  server.get(
    previewChannelPage.path,
    {
      schema: {
        ...contractSchema(previewChannelPage),
        querystring: previewChannelPage.query,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      const { as, tab, seed, locale } = request.query;
      reply.header('Cache-Control', 'no-store');
      return sendResult(
        reply,
        request,
        await channelPageService.preview(user, acting, as, {
          tab,
          seed,
          locales: localeChainOf(locale, request.headers['accept-language']),
        })
      );
    }
  );
}
