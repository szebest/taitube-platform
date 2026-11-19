import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';

export function isVersionConflict(error: Error): boolean {
  return error instanceof ApiError && error.code === ErrorCodes.VERSION_CONFLICT;
}
