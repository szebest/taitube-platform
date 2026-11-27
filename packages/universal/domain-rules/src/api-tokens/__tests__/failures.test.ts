import { ErrorCodes } from '@vp/errors';
import {
  apiTokenLimitReached,
  apiTokenNotFound,
  apiTokenRateLimited,
  apiTokenRefused,
  apiTokenScopeMissing,
  apiTokenWithSession,
} from '../failures';

describe('@vp/domain-rules: api token failures', () => {
  it.each([
    {
      failure: apiTokenNotFound('t1'),
      code: ErrorCodes.API_TOKEN_NOT_FOUND,
      fields: { tokenId: 't1' },
    },
    {
      failure: apiTokenLimitReached(),
      code: ErrorCodes.API_TOKEN_LIMIT_REACHED,
      fields: { limit: 10 },
    },
    {
      failure: apiTokenScopeMissing('videos:write'),
      code: ErrorCodes.API_TOKEN_SCOPE_MISSING,
      fields: { scope: 'videos:write' },
    },
    {
      failure: apiTokenScopeMissing(null),
      code: ErrorCodes.API_TOKEN_SCOPE_MISSING,
      fields: { scope: null },
    },
    { failure: apiTokenWithSession(), code: ErrorCodes.API_TOKEN_WITH_SESSION, fields: {} },
    {
      failure: apiTokenRateLimited(42),
      code: ErrorCodes.RATE_LIMITED,
      fields: { retryAfterSeconds: 42 },
    },
    {
      failure: apiTokenRefused('token expired'),
      code: ErrorCodes.UNAUTHORIZED,
      fields: { reason: 'token expired' },
    },
  ])('$code carries $fields', ({ failure, code, fields }) => {
    expect(failure).toMatchObject({ code, ...fields });
  });

  it.each([
    {
      scope: 'videos:write' as const,
      message: 'This route needs a token with the videos:write scope',
    },
    { scope: null, message: 'A personal access token cannot call this route' },
  ])('tells a script what the route needs: $scope', ({ scope, message }) => {
    expect(apiTokenScopeMissing(scope).message).toBe(message);
  });
});
