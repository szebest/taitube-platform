import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, INVALID_CURSOR, RATE_LIMITED } = ErrorCodes;

export const SDD_SEARCH_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/search',
    method: 'get',
    expectedStatuses: [200, 400, 422, 429],
    expectedErrorCodes: [VALIDATION_FAILED, INVALID_CURSOR, RATE_LIMITED],
    hasQueryParams: true,
  },
  {
    path: '/v1/search/suggestions',
    method: 'get',
    expectedStatuses: [200, 400, 422, 429],
    expectedErrorCodes: [VALIDATION_FAILED, RATE_LIMITED],
    hasQueryParams: true,
  },
];
