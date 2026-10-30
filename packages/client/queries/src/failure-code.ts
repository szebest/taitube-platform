import { ApiError } from '@vp/api-client';
import { type ErrorCode, ErrorCodes, isErrorCode } from '@vp/errors';

/** The code the API answered with; anything that is not one of its problem documents is `INTERNAL`. */
export function failureCode(error: unknown): ErrorCode {
  return error instanceof ApiError && isErrorCode(error.code) ? error.code : ErrorCodes.INTERNAL;
}
