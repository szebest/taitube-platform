import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  INVALID_CURSOR,
  CHANNEL_NOT_FOUND,
  CANNOT_SUBSCRIBE_TO_SELF,
} = ErrorCodes;
const CHANNEL = [VALIDATION_FAILED, UNAUTHORIZED, CHANNEL_NOT_FOUND];

export const SDD_CHANNEL_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/channels/{idOrHandle}',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, CHANNEL_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/channels/{idOrHandle}/videos',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, INVALID_CURSOR, CHANNEL_NOT_FOUND],
    hasQueryParams: true,
    hasPathParams: true,
  },
  {
    path: '/v1/channels/{idOrHandle}/playlists',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, INVALID_CURSOR, CHANNEL_NOT_FOUND],
    hasQueryParams: true,
    hasPathParams: true,
  },
  {
    path: '/v1/channels/{idOrHandle}/featured',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, CHANNEL_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/me/channel/featured',
    method: 'put',
    expectedStatuses: [200, 400, 401, 403, 404, 422],
    expectedErrorCodes: [
      VALIDATION_FAILED,
      UNAUTHORIZED,
      ErrorCodes.FORBIDDEN,
      CHANNEL_NOT_FOUND,
      ErrorCodes.VIDEO_NOT_FOUND,
    ],
    hasBody: true,
  },
  {
    path: '/v1/channels/{id}/subscribers',
    method: 'post',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: [...CHANNEL, CANNOT_SUBSCRIBE_TO_SELF],
    hasPathParams: true,
  },
  {
    path: '/v1/channels/{id}/subscribers',
    method: 'delete',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: CHANNEL,
    hasPathParams: true,
  },
  {
    path: '/v1/channels/{id}/subscribers/me',
    method: 'get',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: CHANNEL,
    hasPathParams: true,
  },
  {
    path: '/v1/channels/{id}/subscribers/me',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: [...CHANNEL, ErrorCodes.FORBIDDEN],
    hasPathParams: true,
    hasBody: true,
  },
];
