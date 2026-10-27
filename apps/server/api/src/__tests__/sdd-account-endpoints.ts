import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, INVALID_CURSOR, FORBIDDEN, VERSION_CONFLICT } = ErrorCodes;
const AUTHENTICATED = [VALIDATION_FAILED, UNAUTHORIZED];

export const SDD_ACCOUNT_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/me/account',
    method: 'get',
    expectedStatuses: [200, 401, 404],
    expectedErrorCodes: [UNAUTHORIZED, ErrorCodes.CHANNEL_NOT_FOUND],
  },
  {
    path: '/v1/me/preferences',
    method: 'get',
    expectedStatuses: [200, 401, 403],
    expectedErrorCodes: [UNAUTHORIZED, FORBIDDEN],
  },
  {
    path: '/v1/me/preferences',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 409, 422],
    expectedErrorCodes: [...AUTHENTICATED, FORBIDDEN, VERSION_CONFLICT],
    hasBody: true,
  },
  {
    path: '/v1/me/notifications',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, INVALID_CURSOR],
    hasQueryParams: true,
  },
  {
    path: '/v1/me/notifications/unread-count',
    method: 'get',
    expectedStatuses: [200, 401],
    expectedErrorCodes: [UNAUTHORIZED],
  },
  {
    path: '/v1/me/notifications/read',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN],
    hasBody: true,
  },
];
