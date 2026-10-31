import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  FORBIDDEN,
  VIDEO_NOT_FOUND,
  PICK_NOT_FOUND,
  PICK_WINDOW_OVERLAP,
} = ErrorCodes;

export const SDD_PICK_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/picks/current',
    method: 'get',
    expectedStatuses: [200, 304, 404],
    expectedErrorCodes: [VIDEO_NOT_FOUND],
  },
  {
    path: '/v1/admin/picks',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN],
    hasQueryParams: true,
  },
  {
    path: '/v1/admin/picks',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [
      VALIDATION_FAILED,
      UNAUTHORIZED,
      FORBIDDEN,
      VIDEO_NOT_FOUND,
      PICK_WINDOW_OVERLAP,
    ],
    hasBody: true,
  },
  {
    path: '/v1/admin/picks/{id}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [
      VALIDATION_FAILED,
      UNAUTHORIZED,
      FORBIDDEN,
      PICK_NOT_FOUND,
      VIDEO_NOT_FOUND,
      PICK_WINDOW_OVERLAP,
    ],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/admin/picks/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, PICK_NOT_FOUND],
    hasPathParams: true,
  },
];
