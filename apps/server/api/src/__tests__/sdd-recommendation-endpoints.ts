import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  FORBIDDEN,
  INVALID_CURSOR,
  VIDEO_NOT_FOUND,
  CHANNEL_NOT_FOUND,
  RECOMMENDATION_FEEDBACK_NOT_FOUND,
} = ErrorCodes;
const AUTHENTICATED = [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN];

export const SDD_RECOMMENDATION_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/home',
    method: 'get',
    expectedStatuses: [200, 401],
    expectedErrorCodes: [UNAUTHORIZED],
  },
  {
    path: '/v1/videos/{id}/related',
    method: 'get',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, VIDEO_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/me/recommendation-feedback',
    method: 'put',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: [...AUTHENTICATED, VIDEO_NOT_FOUND, CHANNEL_NOT_FOUND],
    hasBody: true,
  },
  {
    path: '/v1/me/recommendation-feedback',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403],
    expectedErrorCodes: [...AUTHENTICATED, INVALID_CURSOR],
    hasQueryParams: true,
  },
  {
    path: '/v1/me/recommendation-feedback/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: [...AUTHENTICATED, RECOMMENDATION_FEEDBACK_NOT_FOUND],
    hasPathParams: true,
  },
];
