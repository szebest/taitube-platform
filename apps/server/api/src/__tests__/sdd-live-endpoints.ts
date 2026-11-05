import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, LIVE_STREAM_NOT_FOUND } = ErrorCodes;
const OWN_STREAM = [VALIDATION_FAILED, UNAUTHORIZED, LIVE_STREAM_NOT_FOUND];

export const SDD_LIVE_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/me/live',
    method: 'post',
    expectedStatuses: [200, 401, 404],
    expectedErrorCodes: [UNAUTHORIZED, ErrorCodes.CHANNEL_NOT_FOUND],
  },
  {
    path: '/v1/me/live',
    method: 'get',
    expectedStatuses: [200, 401, 404],
    expectedErrorCodes: [UNAUTHORIZED, LIVE_STREAM_NOT_FOUND],
  },
  {
    path: '/v1/me/live/{id}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 404, 422],
    expectedErrorCodes: OWN_STREAM,
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/me/live/{id}/stop',
    method: 'post',
    expectedStatuses: [202, 400, 401, 404, 409, 503],
    expectedErrorCodes: [
      ...OWN_STREAM,
      ErrorCodes.LIVE_STREAM_NOT_LIVE,
      ErrorCodes.LIVE_GATEWAY_UNAVAILABLE,
    ],
    hasPathParams: true,
  },
];
