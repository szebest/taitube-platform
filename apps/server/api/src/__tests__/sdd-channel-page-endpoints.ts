import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  FORBIDDEN,
  INVALID_CURSOR,
  CHANNEL_NOT_FOUND,
  CHANNEL_MEMBERSHIP_REQUIRED,
  VERSION_CONFLICT,
  REVISION_NOT_FOUND,
  LAYOUT_LIMIT_EXCEEDED,
  LAYOUT_REFERENCE_INVALID,
  LAYOUT_SCHEDULE_INVALID,
  LAYOUT_SCHEDULE_NOT_FOUND,
} = ErrorCodes;

const STUDIO = [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, CHANNEL_MEMBERSHIP_REQUIRED];

export const SDD_CHANNEL_PAGE_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/channels/{idOrHandle}/page',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, CHANNEL_NOT_FOUND],
    hasPathParams: true,
    hasQueryParams: true,
  },
  {
    path: '/v1/me/channel/page/draft',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403],
    expectedErrorCodes: STUDIO,
  },
  {
    path: '/v1/me/channel/page/draft',
    method: 'put',
    expectedStatuses: [200, 400, 401, 403, 409, 422],
    expectedErrorCodes: [...STUDIO, VERSION_CONFLICT, LAYOUT_LIMIT_EXCEEDED],
    hasBody: true,
  },
  {
    path: '/v1/me/channel/page/publish',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 409, 422],
    expectedErrorCodes: [...STUDIO, VERSION_CONFLICT, LAYOUT_REFERENCE_INVALID],
    hasBody: true,
  },
  {
    path: '/v1/me/channel/page/schedule',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403],
    expectedErrorCodes: STUDIO,
  },
  {
    path: '/v1/me/channel/page/schedule',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 422],
    expectedErrorCodes: [...STUDIO, REVISION_NOT_FOUND, LAYOUT_SCHEDULE_INVALID],
    hasBody: true,
  },
  {
    path: '/v1/me/channel/page/schedule/{id}',
    method: 'delete',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: [...STUDIO, LAYOUT_SCHEDULE_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/me/channel/page/revisions',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403],
    expectedErrorCodes: [...STUDIO, INVALID_CURSOR],
    hasQueryParams: true,
  },
  {
    path: '/v1/me/channel/page/revisions/{id}/restore',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: [...STUDIO, REVISION_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/me/channel/page/preview',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: [...STUDIO, CHANNEL_NOT_FOUND],
    hasQueryParams: true,
  },
];
