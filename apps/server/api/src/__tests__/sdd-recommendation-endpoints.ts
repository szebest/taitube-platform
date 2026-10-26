import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, VIDEO_NOT_FOUND } = ErrorCodes;

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
];
