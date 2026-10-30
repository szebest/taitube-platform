import {
  deleteCaptionTrack,
  editCaptionCues,
  generateCaptions,
  getTranscript,
  listCaptions,
  problemFor,
  setChannelAutoCaptions,
  updateCaptionSettings,
  uploadCaptionTrack,
} from '@vp/api-contracts';
import { MAX_CAPTION_FILE_BYTES } from '@vp/domain';
import { publicReadFailure, type VideoForbidden } from '@vp/domain-rules';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { requireAuth } from '../plugins/auth';
import { contractSchema } from './contract-schema';
import { sendResult } from './send-result';

/** A video the caller cannot see answers as missing; a refusal on one they can see stays a 403. */
function disguised(request: FastifyRequest) {
  return {
    on: {
      FORBIDDEN: (failure: VideoForbidden) => problemFor(publicReadFailure(failure), request.url),
    },
  };
}

export async function captionsRoutes(app: FastifyInstance): Promise<void> {
  const { captionService, captionTrackService } = app.services;
  const server = app.withTypeProvider<ZodTypeProvider>();

  app.addContentTypeParser('text/vtt', { parseAs: 'string' }, (_request, body, done) =>
    done(null, body)
  );

  server.get(
    listCaptions.path,
    { schema: { ...contractSchema(listCaptions), params: listCaptions.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await captionService.list(request.user ?? null, request.params.id),
        disguised(request)
      )
  );

  server.get(
    getTranscript.path,
    {
      schema: {
        ...contractSchema(getTranscript),
        params: getTranscript.params,
        querystring: getTranscript.query,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await captionService.transcript(request.user ?? null, request.params.id, request.query),
        disguised(request)
      )
  );

  server.patch(
    updateCaptionSettings.path,
    {
      schema: {
        ...contractSchema(updateCaptionSettings),
        params: updateCaptionSettings.params,
        body: updateCaptionSettings.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await captionService.setAutoCaptions(
          requireAuth(request),
          request.params.id,
          request.body.autoCaptions,
          { requestId: request.id }
        ),
        disguised(request)
      )
  );

  server.put(
    uploadCaptionTrack.path,
    {
      bodyLimit: MAX_CAPTION_FILE_BYTES,
      schema: {
        ...contractSchema(uploadCaptionTrack),
        consumes: ['text/vtt', 'application/json'],
        params: uploadCaptionTrack.params,
        body: uploadCaptionTrack.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await captionTrackService.upload(
          requireAuth(request),
          request.params.id,
          request.params.lang,
          request.body
        ),
        disguised(request)
      )
  );

  server.patch(
    editCaptionCues.path,
    {
      schema: {
        ...contractSchema(editCaptionCues),
        params: editCaptionCues.params,
        body: editCaptionCues.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await captionTrackService.editCues(
          requireAuth(request),
          request.params.id,
          request.params.lang,
          request.body
        ),
        disguised(request)
      )
  );

  server.delete(
    deleteCaptionTrack.path,
    { schema: { ...contractSchema(deleteCaptionTrack), params: deleteCaptionTrack.params } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await captionTrackService.remove(
          requireAuth(request),
          request.params.id,
          request.params.lang
        ),
        { ...disguised(request), status: deleteCaptionTrack.status }
      )
  );

  server.post(
    generateCaptions.path,
    {
      schema: {
        ...contractSchema(generateCaptions),
        params: generateCaptions.params,
        body: generateCaptions.body,
      },
    },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await captionService.generate(requireAuth(request), request.params.id, request.body, {
          requestId: request.id,
        }),
        { ...disguised(request), status: generateCaptions.status }
      )
  );

  server.put(
    setChannelAutoCaptions.path,
    { schema: { ...contractSchema(setChannelAutoCaptions), body: setChannelAutoCaptions.body } },
    async (request, reply) =>
      sendResult(
        reply,
        request,
        await captionService.setChannelDefault(requireAuth(request), request.body.enabled)
      )
  );
}
