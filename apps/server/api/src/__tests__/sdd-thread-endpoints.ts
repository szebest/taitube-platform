import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  INVALID_CURSOR,
  VIDEO_NOT_FOUND,
  THREAD_NOT_FOUND,
  THREAD_LIMIT,
  THREAD_PIN_LIMIT,
  THREAD_ANCHOR_INVALID,
  COMMENT_NOT_FOUND,
  COMMENTS_SLOW_MODE,
  COMMENTS_BANNED,
  MODERATION_NOT_APPLICABLE,
} = ErrorCodes;

const SIGNED_IN = [VALIDATION_FAILED, UNAUTHORIZED];

export const SDD_THREAD_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/videos/{id}/threads',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, VIDEO_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/threads',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 422, 429],
    expectedErrorCodes: [
      ...SIGNED_IN,
      VIDEO_NOT_FOUND,
      THREAD_ANCHOR_INVALID,
      THREAD_LIMIT,
      COMMENTS_SLOW_MODE,
      COMMENTS_BANNED,
    ],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/threads/{id}',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, THREAD_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/threads/{id}/comments',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, INVALID_CURSOR, THREAD_NOT_FOUND],
    hasPathParams: true,
    hasQueryParams: true,
  },
  {
    path: '/v1/threads/{id}/comments',
    method: 'post',
    expectedStatuses: [201, 400, 401, 404, 429],
    expectedErrorCodes: [...SIGNED_IN, THREAD_NOT_FOUND, COMMENT_NOT_FOUND, COMMENTS_SLOW_MODE],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/threads/{id}/pin',
    method: 'post',
    expectedStatuses: [200, 401, 403, 404, 409],
    expectedErrorCodes: [UNAUTHORIZED, THREAD_NOT_FOUND, THREAD_PIN_LIMIT],
    hasPathParams: true,
  },
  {
    path: '/v1/threads/{id}/pin',
    method: 'delete',
    expectedStatuses: [200, 401, 403, 404],
    expectedErrorCodes: [UNAUTHORIZED, THREAD_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/threads/{id}/remove',
    method: 'post',
    expectedStatuses: [204, 400, 401, 403, 404, 409],
    expectedErrorCodes: [...SIGNED_IN, THREAD_NOT_FOUND, MODERATION_NOT_APPLICABLE],
    hasPathParams: true,
    hasBody: true,
  },
];
