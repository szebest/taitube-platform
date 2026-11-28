import {
  getChannelAnalytics,
  getVideoAnalytics,
  getVideoAudience,
  getVideoBenchmark,
  getVideoRetention,
} from '@vp/api-contracts';
import { publicReadFailure } from '@vp/domain-rules';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireActingChannel, requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { problemOf, sendResult } from './send-result';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  const { analyticsService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    getVideoAnalytics.path,
    {
      schema: {
        ...contractSchema(getVideoAnalytics),
        params: getVideoAnalytics.params,
        querystring: getVideoAnalytics.query,
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(
        reply,
        request,
        await analyticsService.videoAnalytics(user, request.params.id, request.query.range),
        { on: { FORBIDDEN: (failure) => problemOf(request, publicReadFailure(failure)) } }
      );
    }
  );

  server.get(
    getVideoRetention.path,
    {
      schema: {
        ...contractSchema(getVideoRetention),
        params: getVideoRetention.params,
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(
        reply,
        request,
        await analyticsService.videoRetention(user, request.params.id),
        { on: { FORBIDDEN: (failure) => problemOf(request, publicReadFailure(failure)) } }
      );
    }
  );

  server.get(
    getVideoAudience.path,
    {
      schema: {
        ...contractSchema(getVideoAudience),
        params: getVideoAudience.params,
        querystring: getVideoAudience.query,
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(
        reply,
        request,
        await analyticsService.videoAudience(user, request.params.id, request.query.range),
        { on: { FORBIDDEN: (failure) => problemOf(request, publicReadFailure(failure)) } }
      );
    }
  );

  server.get(
    getVideoBenchmark.path,
    {
      schema: {
        ...contractSchema(getVideoBenchmark),
        params: getVideoBenchmark.params,
      },
    },
    async (request, reply) => {
      const user = requireAuth(request);
      return sendResult(
        reply,
        request,
        await analyticsService.videoBenchmark(user, request.params.id),
        { on: { FORBIDDEN: (failure) => problemOf(request, publicReadFailure(failure)) } }
      );
    }
  );

  server.get(
    getChannelAnalytics.path,
    {
      schema: {
        ...contractSchema(getChannelAnalytics),
        querystring: getChannelAnalytics.query,
      },
    },
    async (request, reply) => {
      const { user, acting } = requireActingChannel(request);
      return sendResult(
        reply,
        request,
        await analyticsService.channelAnalytics(user, acting, request.query.range)
      );
    }
  );
}
