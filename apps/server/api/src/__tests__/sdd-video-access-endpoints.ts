import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  FORBIDDEN,
  VIDEO_NOT_FOUND,
  VERSION_CONFLICT,
  RATE_LIMITED,
  SHARE_LINK_NOT_FOUND,
  SHARE_LINK_LIMIT,
  VIDEO_PASSWORD_INVALID,
  VIDEO_PASSWORDS_OFF,
  EXPERIMENT_NOT_FOUND,
  EXPERIMENT_LIMIT,
  EXPERIMENT_NOT_RUNNING,
} = ErrorCodes;

const EDITED_VIDEO = [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND];

export const SDD_VIDEO_ACCESS_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/telemetry/impressions',
    method: 'post',
    expectedStatuses: [204, 400, 413, 429],
    expectedErrorCodes: [VALIDATION_FAILED, RATE_LIMITED],
    hasBody: true,
  },
  {
    path: '/v1/creator/videos/{id}/share-links',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: EDITED_VIDEO,
    hasPathParams: true,
  },
  {
    path: '/v1/creator/videos/{id}/share-links',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [...EDITED_VIDEO, SHARE_LINK_LIMIT],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/creator/videos/{id}/share-links/{linkId}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: [...EDITED_VIDEO, SHARE_LINK_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/creator/videos/{id}/password',
    method: 'put',
    expectedStatuses: [200, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [...EDITED_VIDEO, VIDEO_PASSWORDS_OFF],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/creator/videos/{id}/password',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: EDITED_VIDEO,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/unlock',
    method: 'post',
    expectedStatuses: [204, 400, 403, 404, 409, 429],
    expectedErrorCodes: [
      VALIDATION_FAILED,
      VIDEO_PASSWORD_INVALID,
      VIDEO_NOT_FOUND,
      VIDEO_PASSWORDS_OFF,
      RATE_LIMITED,
    ],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/creator/videos/{id}/experiments',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: EDITED_VIDEO,
    hasPathParams: true,
  },
  {
    path: '/v1/creator/videos/{id}/experiments',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [...EDITED_VIDEO, EXPERIMENT_LIMIT],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/creator/videos/{id}/experiments/{experimentId}/stop',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: [...EDITED_VIDEO, EXPERIMENT_NOT_FOUND, EXPERIMENT_NOT_RUNNING],
    hasPathParams: true,
  },
  {
    path: '/v1/creator/videos/{id}/experiments/{experimentId}/apply',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [
      ...EDITED_VIDEO,
      EXPERIMENT_NOT_FOUND,
      EXPERIMENT_NOT_RUNNING,
      VERSION_CONFLICT,
    ],
    hasPathParams: true,
    hasBody: true,
  },
];
