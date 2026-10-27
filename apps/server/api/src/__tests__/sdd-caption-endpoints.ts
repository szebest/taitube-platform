import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, VIDEO_NOT_FOUND, CAPTION_NOT_FOUND } =
  ErrorCodes;
const READ = [VALIDATION_FAILED, UNAUTHORIZED, VIDEO_NOT_FOUND];
const MANAGE = [...READ, FORBIDDEN];
const TRACK = [...MANAGE, CAPTION_NOT_FOUND];

export const SDD_CAPTION_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/videos/{id}/captions',
    method: 'get',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: READ,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/transcript',
    method: 'get',
    expectedStatuses: [200, 400, 401, 404, 422],
    expectedErrorCodes: [...READ, CAPTION_NOT_FOUND],
    hasPathParams: true,
    hasQueryParams: true,
  },
  {
    path: '/v1/videos/{id}/captions',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: MANAGE,
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/captions/{lang}',
    method: 'put',
    expectedStatuses: [200, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [...MANAGE, ErrorCodes.CAPTION_TRACK_LIMIT],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/captions/{lang}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [...TRACK, ErrorCodes.VERSION_CONFLICT],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/captions/{lang}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404, 422],
    expectedErrorCodes: TRACK,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/captions/generate',
    method: 'post',
    expectedStatuses: [202, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [...MANAGE, ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/me/channel/auto-captions',
    method: 'put',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, ErrorCodes.CHANNEL_NOT_FOUND],
    hasBody: true,
  },
];
