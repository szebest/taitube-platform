import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  FORBIDDEN,
  VIDEO_NOT_FOUND,
  VERSION_CONFLICT,
  UPLOAD_TOO_LARGE,
  UNSUPPORTED_CONTENT_TYPE,
  GENERATION_IN_PROGRESS,
  REPLACEMENT_NOT_UPLOADED,
  NO_EDIT_TO_REVERT,
} = ErrorCodes;

const EDITED_VIDEO = [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND];

export const SDD_VIDEO_PIPELINE_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/creator/videos/{id}/generations',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: EDITED_VIDEO,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/replacement',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [
      ...EDITED_VIDEO,
      GENERATION_IN_PROGRESS,
      UPLOAD_TOO_LARGE,
      UNSUPPORTED_CONTENT_TYPE,
    ],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/videos/{id}/replacement/complete',
    method: 'post',
    expectedStatuses: [202, 400, 401, 403, 404, 409],
    expectedErrorCodes: [...EDITED_VIDEO, REPLACEMENT_NOT_UPLOADED],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/videos/{id}/edits',
    method: 'put',
    expectedStatuses: [202, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [...EDITED_VIDEO, GENERATION_IN_PROGRESS],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/videos/{id}/edits/revert',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: [...EDITED_VIDEO, NO_EDIT_TO_REVERT, VERSION_CONFLICT],
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/creator/videos/{id}/clip-suggestions',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: EDITED_VIDEO,
    hasPathParams: true,
  },
];
