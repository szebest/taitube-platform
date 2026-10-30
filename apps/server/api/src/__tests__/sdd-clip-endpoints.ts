import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  FORBIDDEN,
  INVALID_CURSOR,
  VIDEO_NOT_FOUND,
  CLIP_NOT_FOUND,
} = ErrorCodes;

export const SDD_CLIP_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/videos/{id}/clips',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 422],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/clips/{id}',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, CLIP_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/me/clips',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, INVALID_CURSOR],
    hasQueryParams: true,
  },
  {
    path: '/v1/clips/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, CLIP_NOT_FOUND],
    hasPathParams: true,
  },
];
