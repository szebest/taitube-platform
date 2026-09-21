import { ErrorCodes } from '@vp/errors';
import { z } from 'zod';
import { defineEndpoint } from './endpoint.js';
import { VideoVisibilitySchema } from './video-resource.js';

export const UPLOAD_STRATEGIES = ['single', 'multipart'] as const;

export const UploadStrategySchema = z.enum(UPLOAD_STRATEGIES);

export const UploadIdParamSchema = z.object({
  uploadId: z.string().uuid(),
});

export const PresignedPartSchema = z.object({
  partNumber: z.number(),
  url: z.string(),
  expiresAt: z.string(),
});

export const StartUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  sizeBytes: z.number().int().min(0),
  contentType: z.string(),
  strategy: UploadStrategySchema.optional(),
  sha256: z.string().optional(),
  title: z.string().optional(),
  visibility: VideoVisibilitySchema.optional(),
});

export const StartedUploadSchema = z.object({
  videoId: z.string().uuid(),
  uploadId: z.string().uuid(),
  strategy: UploadStrategySchema,
  singleUrl: z.string().optional(),
  headers: z.record(z.string()).optional(),
  partSizeBytes: z.number().optional(),
  partsExpected: z.number().optional(),
  parts: z.array(PresignedPartSchema).optional(),
  expiresAt: z.string(),
});

export const UploadResumeSchema = z.object({
  status: z.string(),
  strategy: z.string(),
  partSizeBytes: z.number().nullable().optional(),
  partsExpected: z.number().nullable().optional(),
  uploadedParts: z
    .array(
      z.object({
        partNumber: z.number(),
        etag: z.string(),
        size: z.number(),
      })
    )
    .optional(),
});

export const CompleteUploadSchema = z
  .object({
    parts: z
      .array(
        z.object({
          partNumber: z.number().int().positive(),
          etag: z.string().min(1),
        })
      )
      .optional(),
  })
  .optional();

export const startUpload = defineEndpoint({
  method: 'POST',
  path: '/v1/uploads',
  tag: 'Uploads',
  summary: 'Start upload',
  description:
    'Initiates a direct-to-storage upload (single PUT for <= 100 MB, multipart for larger files).',
  body: StartUploadSchema,
  status: 201,
  result: StartedUploadSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    422: [
      ErrorCodes.UPLOAD_TOO_LARGE,
      ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
      ErrorCodes.QUOTA_EXCEEDED,
    ],
    429: [ErrorCodes.RATE_LIMITED],
  },
});

export const getUpload = defineEndpoint({
  method: 'GET',
  path: '/v1/uploads/:uploadId',
  tag: 'Uploads',
  summary: 'Get upload resume info',
  description: 'Returns uploaded parts and resume information for multipart uploads.',
  params: UploadIdParamSchema,
  status: 200,
  result: UploadResumeSchema,
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export const issueUploadParts = defineEndpoint({
  method: 'POST',
  path: '/v1/uploads/:uploadId/parts',
  tag: 'Uploads',
  summary: 'Issue additional part presigned URLs',
  description: 'Issues additional presigned URLs for multipart upload parts beyond the first 100.',
  params: UploadIdParamSchema,
  query: z.object({
    from: z.coerce.number().int().min(1).default(1),
    count: z.coerce.number().int().min(1).max(100).default(100),
  }),
  status: 200,
  result: z.object({ parts: z.array(PresignedPartSchema) }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    410: [ErrorCodes.UPLOAD_NOT_OPEN, ErrorCodes.UPLOAD_EXPIRED],
  },
});

export const completeUpload = defineEndpoint({
  method: 'POST',
  path: '/v1/uploads/:uploadId/complete',
  tag: 'Uploads',
  summary: 'Finish upload',
  description:
    'Completes upload, triggers HEAD validation, transitions video to UPLOADED, and enqueues probe stage.',
  params: UploadIdParamSchema,
  body: CompleteUploadSchema,
  status: 202,
  result: z.object({
    videoId: z.string().uuid(),
    status: z.string(),
    admission: z.enum(['admitted', 'held']).optional(),
  }),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
    410: [ErrorCodes.UPLOAD_NOT_OPEN],
    422: [
      ErrorCodes.UPLOAD_SIZE_MISMATCH,
      ErrorCodes.UPLOAD_TOO_LARGE,
      ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
      ErrorCodes.VALIDATION_FAILED,
    ],
  },
});

export const abortUpload = defineEndpoint({
  method: 'DELETE',
  path: '/v1/uploads/:uploadId',
  tag: 'Uploads',
  summary: 'Abort upload',
  description: 'Aborts a multipart upload and transitions video status to ABANDONED.',
  params: UploadIdParamSchema,
  status: 204,
  result: z.null().describe('Upload successfully aborted'),
  errors: {
    400: [ErrorCodes.VALIDATION_FAILED],
    401: [ErrorCodes.UNAUTHORIZED],
    403: [ErrorCodes.FORBIDDEN],
    404: [ErrorCodes.VIDEO_NOT_FOUND],
  },
});

export type UploadStrategy = z.infer<typeof UploadStrategySchema>;
export type StartUpload = z.infer<typeof StartUploadSchema>;
export type StartedUpload = z.infer<typeof StartedUploadSchema>;
export type UploadResume = z.infer<typeof UploadResumeSchema>;
export type PresignedPart = z.infer<typeof PresignedPartSchema>;
