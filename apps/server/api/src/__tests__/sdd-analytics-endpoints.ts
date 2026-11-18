import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND } = ErrorCodes;
const OWNED_VIDEO = [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND];

export const SDD_ANALYTICS_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/creator/videos/{id}/retention',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: OWNED_VIDEO,
    hasPathParams: true,
  },
  {
    path: '/v1/creator/videos/{id}/analytics',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: OWNED_VIDEO,
    hasQueryParams: true,
    hasPathParams: true,
  },
  {
    path: '/v1/creator/videos/{id}/audience',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: OWNED_VIDEO,
    hasQueryParams: true,
    hasPathParams: true,
  },
  {
    path: '/v1/creator/videos/{id}/benchmark',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: OWNED_VIDEO,
    hasPathParams: true,
  },
];
