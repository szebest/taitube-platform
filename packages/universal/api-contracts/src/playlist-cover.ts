import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import {
  CropRectSchema,
  PrepareImageBodySchema,
  PreparedImageSchema,
  QueuedImageSchema,
  UploadedImageSchema,
} from './channel-images';
import { defineEndpoint } from './endpoint';

const PlaylistParamSchema = z.object({ id: z.uuid({ error: 'Invalid playlist ID format' }) });

const COVER_ERRORS = {
  400: [ErrorCodes.VALIDATION_FAILED, ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE],
  401: [ErrorCodes.UNAUTHORIZED],
  403: [ErrorCodes.FORBIDDEN],
  404: [ErrorCodes.PLAYLIST_NOT_FOUND, ErrorCodes.CHANNEL_NOT_FOUND],
} as const;

export const preparePlaylistCover = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/cover/upload',
  tag: 'Playlists',
  summary: 'Presign a custom cover upload',
  description:
    "The owner gets a presigned PUT into the private raw bucket for a cover image (jpeg, png or webp, at most 2 MB), kept under their primary channel's images. PUT the file, then call `completePlaylistCover`. Watch Later takes no cover.",
  params: PlaylistParamSchema,
  body: PrepareImageBodySchema,
  status: 201,
  result: PreparedImageSchema,
  errors: {
    ...COVER_ERRORS,
    422: [ErrorCodes.UPLOAD_TOO_LARGE, ErrorCodes.UNSUPPORTED_CONTENT_TYPE],
  },
});

export const completePlaylistCover = defineEndpoint({
  method: 'POST',
  path: '/v1/playlists/:id/cover/complete',
  tag: 'Playlists',
  summary: 'Crop an uploaded cover and start processing it',
  description:
    'Checks the uploaded file (type, size, at least 640 x 360) and its 16:9 `crop`, then queues the job that writes the WebP variants. Answers 202; once `channel.image.ready` arrives on `GET /v1/me/events`, `PATCH /v1/playlists/:id` with `coverUploadId` makes it the cover. Completing the same upload again answers the same version.',
  params: PlaylistParamSchema,
  body: UploadedImageSchema.extend({
    crop: CropRectSchema.describe('16:9, in pixels of the uploaded file'),
  }),
  status: 202,
  result: QueuedImageSchema,
  errors: {
    ...COVER_ERRORS,
    404: [...COVER_ERRORS[404], ErrorCodes.IMAGE_UPLOAD_NOT_FOUND],
    422: [
      ErrorCodes.VALIDATION_FAILED,
      ErrorCodes.UPLOAD_SIZE_MISMATCH,
      ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
      ErrorCodes.IMAGE_TOO_SMALL,
    ],
  },
});
