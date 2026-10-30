import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, INVALID_CURSOR, SEARCH_HISTORY_NOT_FOUND } = ErrorCodes;
const AUTHENTICATED = [VALIDATION_FAILED, UNAUTHORIZED];
const PAGED = [...AUTHENTICATED, INVALID_CURSOR];

export const SDD_VIEWER_ACTIVITY_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/me/searches',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: PAGED,
    hasQueryParams: true,
  },
  {
    path: '/v1/me/searches',
    method: 'delete',
    expectedStatuses: [204, 401],
    expectedErrorCodes: [UNAUTHORIZED],
  },
  {
    path: '/v1/me/searches/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 404],
    expectedErrorCodes: [...AUTHENTICATED, SEARCH_HISTORY_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/me/liked-videos',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: PAGED,
    hasQueryParams: true,
  },
  {
    path: '/v1/me/comments',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: PAGED,
    hasQueryParams: true,
  },
];
