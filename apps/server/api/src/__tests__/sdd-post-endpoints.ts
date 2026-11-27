import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  INVALID_CURSOR,
  CHANNEL_NOT_FOUND,
  POST_NOT_FOUND,
  POST_SHARE_NOT_PUBLIC,
  POST_DAILY_LIMIT,
  VERSION_CONFLICT,
  COMMENTS_SLOW_MODE,
} = ErrorCodes;

const SIGNED_IN = [VALIDATION_FAILED, UNAUTHORIZED];

export const SDD_POST_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/channels/{idOrHandle}/posts',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, INVALID_CURSOR, CHANNEL_NOT_FOUND],
    hasPathParams: true,
    hasQueryParams: true,
  },
  {
    path: '/v1/posts/{id}',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, POST_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/me/channel/posts',
    method: 'post',
    expectedStatuses: [201, 400, 401, 422, 429],
    expectedErrorCodes: [...SIGNED_IN, POST_SHARE_NOT_PUBLIC, POST_DAILY_LIMIT],
    hasBody: true,
  },
  {
    path: '/v1/me/channel/posts/{id}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 404, 409, 422],
    expectedErrorCodes: [...SIGNED_IN, POST_NOT_FOUND, VERSION_CONFLICT, POST_SHARE_NOT_PUBLIC],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/me/channel/posts/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 404],
    expectedErrorCodes: [...SIGNED_IN, POST_NOT_FOUND],
    hasPathParams: true,
  },
  ...(['put', 'delete'] as const).map((method): SddEndpointContract => ({
    path: '/v1/posts/{id}/reactions',
    method,
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: [...SIGNED_IN, POST_NOT_FOUND],
    hasPathParams: true,
  })),
  {
    path: '/v1/feed/community',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: [...SIGNED_IN, INVALID_CURSOR],
    hasQueryParams: true,
  },
  {
    path: '/v1/posts/{id}/comments',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, INVALID_CURSOR, POST_NOT_FOUND],
    hasPathParams: true,
    hasQueryParams: true,
  },
  {
    path: '/v1/posts/{id}/comments',
    method: 'post',
    expectedStatuses: [201, 400, 401, 404, 429],
    expectedErrorCodes: [...SIGNED_IN, POST_NOT_FOUND, COMMENTS_SLOW_MODE],
    hasPathParams: true,
    hasBody: true,
  },
];
