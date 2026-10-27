import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, COMMENT_NOT_FOUND } = ErrorCodes;
const AUTHENTICATED = [VALIDATION_FAILED, UNAUTHORIZED];
const OWNED_VIDEO = [...AUTHENTICATED, FORBIDDEN, ErrorCodes.VIDEO_NOT_FOUND];
const LISTED = [VALIDATION_FAILED, ErrorCodes.INVALID_CURSOR, UNAUTHORIZED];
const MODERATED = [...AUTHENTICATED, FORBIDDEN, COMMENT_NOT_FOUND];
const PINNED = [...MODERATED, ErrorCodes.COMMENT_NOT_PINNABLE];

export const SDD_COMMENT_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/videos/{id}/comments',
    method: 'get',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: [...LISTED, ErrorCodes.VIDEO_NOT_FOUND],
    hasQueryParams: true,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/comments',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 422],
    expectedErrorCodes: [...OWNED_VIDEO, ErrorCodes.COMMENT_NOT_FOUND],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/comments/{id}/replies',
    method: 'get',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: [...LISTED, ErrorCodes.COMMENT_NOT_FOUND],
    hasQueryParams: true,
    hasPathParams: true,
  },
  {
    path: '/v1/comments/{id}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404, 422],
    expectedErrorCodes: MODERATED,
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/comments/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: MODERATED,
    hasPathParams: true,
  },
  {
    path: '/v1/comments/{id}/pin',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: PINNED,
    hasPathParams: true,
  },
  {
    path: '/v1/comments/{id}/pin',
    method: 'delete',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: PINNED,
    hasPathParams: true,
  },
  {
    path: '/v1/comments/{id}/heart',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: MODERATED,
    hasPathParams: true,
  },
  {
    path: '/v1/comments/{id}/heart',
    method: 'delete',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: MODERATED,
    hasPathParams: true,
  },
  {
    path: '/v1/comments/{id}/reports',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [
      ...MODERATED,
      ErrorCodes.VIDEO_NOT_FOUND,
      ErrorCodes.COMMENT_ALREADY_REPORTED,
    ],
    hasBody: true,
    hasPathParams: true,
  },
];
