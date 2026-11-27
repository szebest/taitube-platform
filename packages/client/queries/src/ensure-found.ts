import { createEnsureFound } from '@kit/query';
import { ApiError } from '@vp/api-client';

const NOT_FOUND = 404;

export const ensureFound = createEnsureFound(
  (error) => error instanceof ApiError && error.status === NOT_FOUND
);
