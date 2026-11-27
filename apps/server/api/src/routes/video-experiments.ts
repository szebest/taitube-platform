import {
  applyVideoExperiment,
  createVideoExperiment,
  listVideoExperiments,
  problemFor,
  stopVideoExperiment,
} from '@vp/api-contracts';
import { publicReadFailure } from '@vp/domain-rules';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function videoExperimentsRoutes(app: FastifyInstance): Promise<void> {
  const { videoExperimentService: experiments } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listVideoExperiments.path,
    { schema: { ...contractSchema(listVideoExperiments), params: listVideoExperiments.params } },
    async (request, reply) =>
      sendResult(reply, request, await experiments.list(requireAuth(request), request.params.id))
  );

  server.post(
    createVideoExperiment.path,
    {
      schema: {
        ...contractSchema(createVideoExperiment),
        params: createVideoExperiment.params,
        body: createVideoExperiment.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await experiments.create(requireAuth(request), request.params.id, request.body),
        { status: createVideoExperiment.status }
      )
  );

  server.post(
    stopVideoExperiment.path,
    { schema: { ...contractSchema(stopVideoExperiment), params: stopVideoExperiment.params } },
    async (request, reply) => {
      const { id, experimentId } = request.params;
      return sendResult(
        reply,
        request,
        await experiments.stop(requireAuth(request), id, experimentId)
      );
    }
  );

  server.post(
    applyVideoExperiment.path,
    {
      schema: {
        ...contractSchema(applyVideoExperiment),
        params: applyVideoExperiment.params,
        body: applyVideoExperiment.body,
      },
    },
    async (request, reply) => {
      const { id, experimentId } = request.params;
      return sendResult(
        reply,
        request,
        await experiments.apply(requireAuth(request), id, experimentId, request.body),
        { on: { FORBIDDEN: (failure) => problemFor(publicReadFailure(failure), request.url) } }
      );
    }
  );
}
