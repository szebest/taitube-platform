import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND, VERSION_CONFLICT } =
  ErrorCodes;
const MODERATED = [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND, VERSION_CONFLICT];

export const SDD_SCREENING_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/admin/screening',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403],
    expectedErrorCodes: [VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR, UNAUTHORIZED, FORBIDDEN],
    hasQueryParams: true,
  },
  {
    path: '/v1/admin/videos/{id}/screening/approve',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: MODERATED,
    hasPathParams: true,
  },
  {
    path: '/v1/admin/videos/{id}/screening/reject',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: MODERATED,
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/admin/videos/{id}/screening/dismiss',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: MODERATED,
    hasPathParams: true,
  },
  {
    path: '/v1/creator/videos/{id}/screening',
    method: 'get',
    expectedStatuses: [200, 401, 403, 404],
    expectedErrorCodes: [UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/creator/videos/{id}/screening/appeal',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 409],
    expectedErrorCodes: MODERATED,
    hasBody: true,
    hasPathParams: true,
  },
];
