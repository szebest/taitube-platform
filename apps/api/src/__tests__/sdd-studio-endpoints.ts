import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND, VERSION_CONFLICT } =
  ErrorCodes;
const OWNED_VIDEO = [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND];

export const SDD_STUDIO_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/creator/videos',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: [VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR, UNAUTHORIZED],
    hasQueryParams: true,
  },
  {
    path: '/v1/creator/videos/{id}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [...OWNED_VIDEO, ErrorCodes.CATEGORY_NOT_FOUND, VERSION_CONFLICT],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/creator/videos/{id}',
    method: 'delete',
    expectedStatuses: [202, 400, 401, 403, 404, 409],
    expectedErrorCodes: [...OWNED_VIDEO, VERSION_CONFLICT],
    hasPathParams: true,
  },
  {
    path: '/v1/admin/videos/{id}/takedown',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: [...OWNED_VIDEO, VERSION_CONFLICT],
    hasBody: true,
    hasPathParams: true,
  },
];
