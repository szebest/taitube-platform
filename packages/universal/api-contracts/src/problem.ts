import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { z } from 'zod';

export const ProblemSchema = z.object({
  type: z.string().describe('URI reference identifying the problem type'),
  title: z.string().describe('Short summary of the problem type'),
  status: z.number().describe('HTTP status code'),
  detail: z.string().describe('Human-readable explanation specific to this occurrence'),
  code: z.string().describe('Machine-readable error code'),
  instance: z.string().describe('URI reference identifying the specific occurrence'),
  errors: z.array(z.unknown()).optional().describe('Validation issues if status is 400'),
});

export type Problem = z.infer<typeof ProblemSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

const PROBLEM_TYPE_BASE = 'https://errors.video-pipeline.local';

function problemType(code: ErrorCode | string): string {
  return `${PROBLEM_TYPE_BASE}/${code}`;
}

/**
 * The status every domain error is reported as. Declared for the whole `ErrorCode`
 * union rather than the codes that happen to surface today, so adding a code is a
 * compile error until someone decides what it looks like over HTTP.
 *
 * Transport-level validation failures are 400 whatever code they carry; that is a
 * property of where the error came from, not of the code, so it is not in here.
 */
const PROBLEM_STATUS: Readonly<Record<ErrorCode, number>> = {
  [ErrorCodes.INVALID_HANDLE_FORMAT]: 400,
  [ErrorCodes.INVALID_CURSOR]: 400,
  [ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF]: 400,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.VIDEO_NOT_FOUND]: 404,
  [ErrorCodes.DLQ_ENTRY_NOT_FOUND]: 404,
  [ErrorCodes.CATEGORY_NOT_FOUND]: 404,
  [ErrorCodes.CHANNEL_NOT_FOUND]: 404,
  [ErrorCodes.VERSION_CONFLICT]: 409,
  [ErrorCodes.CATEGORY_SLUG_CONFLICT]: 409,
  [ErrorCodes.CATEGORY_IN_USE]: 409,
  [ErrorCodes.HANDLE_ALREADY_TAKEN]: 409,
  [ErrorCodes.UPLOAD_NOT_OPEN]: 410,
  [ErrorCodes.UPLOAD_EXPIRED]: 410,
  [ErrorCodes.UPLOAD_TOO_LARGE]: 422,
  [ErrorCodes.UPLOAD_SIZE_MISMATCH]: 422,
  [ErrorCodes.UNSUPPORTED_CONTENT_TYPE]: 422,
  [ErrorCodes.QUOTA_EXCEEDED]: 422,
  [ErrorCodes.VALIDATION_FAILED]: 422,
  [ErrorCodes.UNSUPPORTED_CODEC]: 422,
  [ErrorCodes.CORRUPT_CONTAINER]: 422,
  [ErrorCodes.DURATION_EXCEEDED]: 422,
  [ErrorCodes.SOURCE_MISSING]: 422,
  [ErrorCodes.SEGMENT_VERIFY_FAILED]: 422,
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.INTERNAL]: 500,
  [ErrorCodes.FFMPEG_FAILED]: 500,
  [ErrorCodes.FFMPEG_OOM]: 500,
  [ErrorCodes.FFMPEG_TIMEOUT]: 500,
  [ErrorCodes.DISK_FULL]: 500,
  [ErrorCodes.ORPHANED]: 500,
  [ErrorCodes.STORAGE_UNAVAILABLE]: 503,
  [ErrorCodes.DATABASE_UNAVAILABLE]: 503,
  [ErrorCodes.CACHE_UNAVAILABLE]: 503,
  [ErrorCodes.QUEUE_UNAVAILABLE]: 503,
};

const UNCLASSIFIED_STATUS = 422;

export function problemStatus(code: ErrorCode | string): number {
  return PROBLEM_STATUS[code as ErrorCode] ?? UNCLASSIFIED_STATUS;
}

export interface ProblemInput {
  code: ErrorCode | string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: unknown[];
}

export function problemDetails(input: ProblemInput): Problem {
  return {
    type: problemType(input.code),
    title: input.title,
    status: input.status,
    detail: input.detail,
    code: input.code,
    instance: input.instance,
    ...(input.errors ? { errors: input.errors } : {}),
  };
}

export function problemResponse(
  codes: readonly string[],
  description = 'Problem Details (RFC 9457)'
): z.ZodTypeAny {
  const [first, ...rest] = codes;
  const code = first === undefined ? z.string() : z.enum([first, ...rest]);
  return ProblemSchema.extend({
    code: code.describe('Machine-readable error code'),
  }).describe(description);
}
