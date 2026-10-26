import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN } = ErrorCodes;
const ADMIN = [UNAUTHORIZED, FORBIDDEN];
const DLQ_ENTRY = [VALIDATION_FAILED, ...ADMIN, ErrorCodes.DLQ_ENTRY_NOT_FOUND];

export const SDD_ADMIN_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/admin/videos/{id}',
    method: 'get',
    expectedStatuses: [200, 401, 403, 404],
    expectedErrorCodes: [...ADMIN, ErrorCodes.VIDEO_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/admin/categories',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 409],
    expectedErrorCodes: [VALIDATION_FAILED, ...ADMIN, ErrorCodes.CATEGORY_SLUG_CONFLICT],
    hasBody: true,
  },
  {
    path: '/v1/admin/categories/{id}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: [
      VALIDATION_FAILED,
      ...ADMIN,
      ErrorCodes.CATEGORY_NOT_FOUND,
      ErrorCodes.CATEGORY_SLUG_CONFLICT,
    ],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/admin/categories/{id}',
    method: 'delete',
    expectedStatuses: [204, 401, 403, 404, 409],
    expectedErrorCodes: [...ADMIN, ErrorCodes.CATEGORY_NOT_FOUND, ErrorCodes.CATEGORY_IN_USE],
    hasPathParams: true,
  },
  {
    path: '/v1/admin/dlq',
    method: 'get',
    expectedStatuses: [200, 401, 403],
    expectedErrorCodes: ADMIN,
    hasQueryParams: true,
  },
  {
    path: '/v1/admin/dlq/{id}/replay',
    method: 'post',
    expectedStatuses: [202, 400, 401, 403, 404],
    expectedErrorCodes: DLQ_ENTRY,
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/admin/dlq/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: DLQ_ENTRY,
    hasPathParams: true,
  },
];
