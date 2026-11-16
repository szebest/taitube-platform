import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, API_TOKEN_LIMIT_REACHED, API_TOKEN_NOT_FOUND } =
  ErrorCodes;

export const SDD_TOKEN_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/me/api-tokens',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 409],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, API_TOKEN_LIMIT_REACHED],
    hasBody: true,
  },
  {
    path: '/v1/me/api-tokens',
    method: 'get',
    expectedStatuses: [200, 401, 403],
    expectedErrorCodes: [UNAUTHORIZED, FORBIDDEN],
  },
  {
    path: '/v1/me/api-tokens/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, API_TOKEN_NOT_FOUND],
    hasPathParams: true,
  },
];
