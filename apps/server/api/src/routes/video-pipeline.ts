import {
  completeVideoReplacement,
  getClipSuggestions,
  listVideoGenerations,
  revertVideoEdits,
  saveVideoEdits,
  startVideoReplacement,
} from '@vp/api-contracts';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

export async function videoPipelineRoutes(app: FastifyInstance): Promise<void> {
  const {
    videoReplacementService: replacements,
    videoEditsService: edits,
    clipSuggestionService: clips,
  } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get(
    listVideoGenerations.path,
    { schema: { ...contractSchema(listVideoGenerations), params: listVideoGenerations.params } },
    async (request, reply) =>
      sendResult(reply, request, await edits.generations(requireAuth(request), request.params.id))
  );

  server.post(
    startVideoReplacement.path,
    {
      schema: {
        ...contractSchema(startVideoReplacement),
        params: startVideoReplacement.params,
        body: startVideoReplacement.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await replacements.start(requireAuth(request), request.params.id, request.body),
        { status: startVideoReplacement.status }
      )
  );

  server.post(
    completeVideoReplacement.path,
    {
      schema: {
        ...contractSchema(completeVideoReplacement),
        params: completeVideoReplacement.params,
        body: completeVideoReplacement.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await replacements.complete(
          requireAuth(request),
          request.params.id,
          request.body.generation
        ),
        { status: completeVideoReplacement.status }
      )
  );

  server.put(
    saveVideoEdits.path,
    {
      schema: {
        ...contractSchema(saveVideoEdits),
        params: saveVideoEdits.params,
        body: saveVideoEdits.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await edits.save(requireAuth(request), request.params.id, request.body),
        { status: saveVideoEdits.status }
      )
  );

  server.post(
    revertVideoEdits.path,
    {
      schema: {
        ...contractSchema(revertVideoEdits),
        params: revertVideoEdits.params,
        body: revertVideoEdits.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await edits.revert(requireAuth(request), request.params.id, request.body.version)
      )
  );

  server.get(
    getClipSuggestions.path,
    { schema: { ...contractSchema(getClipSuggestions), params: getClipSuggestions.params } },
    async (request, reply) =>
      sendResult(reply, request, await clips.suggest(requireAuth(request), request.params.id))
  );
}
