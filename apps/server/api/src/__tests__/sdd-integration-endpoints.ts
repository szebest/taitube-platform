import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  VIDEO_NOT_FOUND,
  WEBHOOK_NOT_FOUND,
  WEBHOOK_LIMIT_REACHED,
  OEMBED_URL_UNSUPPORTED,
  OEMBED_FORMAT_UNSUPPORTED,
} = ErrorCodes;

export const SDD_INTEGRATION_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/oembed',
    method: 'get',
    expectedStatuses: [200, 400, 404, 501],
    expectedErrorCodes: [
      VALIDATION_FAILED,
      OEMBED_URL_UNSUPPORTED,
      VIDEO_NOT_FOUND,
      OEMBED_FORMAT_UNSUPPORTED,
    ],
    hasQueryParams: true,
  },
  {
    path: '/v1/me/webhooks',
    method: 'post',
    expectedStatuses: [201, 400, 401, 409, 422],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, WEBHOOK_LIMIT_REACHED],
    hasBody: true,
  },
  {
    path: '/v1/me/webhooks',
    method: 'get',
    expectedStatuses: [200, 401],
    expectedErrorCodes: [UNAUTHORIZED],
  },
  {
    path: '/v1/me/webhooks/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 404],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, WEBHOOK_NOT_FOUND],
    hasPathParams: true,
  },
];
