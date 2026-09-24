import { type ErrorCode, ErrorCodes } from '@vp/errors';

export interface SddEndpointContract {
  path: string;
  method: 'get' | 'post' | 'patch' | 'delete' | 'put';
  expectedStatuses: number[];
  expectedErrorCodes?: ErrorCode[];
  hasQueryParams?: boolean;
  hasBody?: boolean;
  hasPathParams?: boolean;
}

const { VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, RATE_LIMITED } = ErrorCodes;
const AUTHENTICATED = [VALIDATION_FAILED, UNAUTHORIZED];
const OWNED_VIDEO = [...AUTHENTICATED, FORBIDDEN, ErrorCodes.VIDEO_NOT_FOUND];
const VIEWED_VIDEO = [...AUTHENTICATED, ErrorCodes.VIDEO_NOT_FOUND];
const CHANNEL = [...AUTHENTICATED, ErrorCodes.CHANNEL_NOT_FOUND];
const ADMIN = [UNAUTHORIZED, FORBIDDEN];
const DLQ_ENTRY = [VALIDATION_FAILED, ...ADMIN, ErrorCodes.DLQ_ENTRY_NOT_FOUND];

export const SDD_ENDPOINT_CONTRACT: SddEndpointContract[] = [
  {
    path: '/v1/uploads',
    method: 'post',
    expectedStatuses: [201, 400, 401, 422, 429],
    expectedErrorCodes: [
      ...AUTHENTICATED,
      ErrorCodes.UPLOAD_TOO_LARGE,
      ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
      ErrorCodes.QUOTA_EXCEEDED,
      RATE_LIMITED,
    ],
    hasBody: true,
  },
  {
    path: '/v1/uploads/{uploadId}',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: OWNED_VIDEO,
    hasPathParams: true,
  },
  {
    path: '/v1/uploads/{uploadId}/parts',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404, 410],
    expectedErrorCodes: [...OWNED_VIDEO, ErrorCodes.UPLOAD_NOT_OPEN],
    hasQueryParams: true,
    hasPathParams: true,
  },
  {
    path: '/v1/uploads/{uploadId}/complete',
    method: 'post',
    expectedStatuses: [202, 400, 401, 403, 404, 410, 422],
    expectedErrorCodes: [
      ...OWNED_VIDEO,
      ErrorCodes.UPLOAD_NOT_OPEN,
      ErrorCodes.UPLOAD_SIZE_MISMATCH,
      ErrorCodes.UPLOAD_TOO_LARGE,
      ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
    ],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/uploads/{uploadId}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: OWNED_VIDEO,
    hasPathParams: true,
  },
  {
    path: '/v1/videos',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: AUTHENTICATED,
    hasQueryParams: true,
  },
  {
    path: '/v1/videos/{id}',
    method: 'get',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: VIEWED_VIDEO,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: [...OWNED_VIDEO, ErrorCodes.VERSION_CONFLICT],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}',
    method: 'delete',
    expectedStatuses: [202, 400, 401, 403, 404],
    expectedErrorCodes: OWNED_VIDEO,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/events',
    method: 'get',
    expectedStatuses: [200, 400, 401, 404, 429],
    expectedErrorCodes: [...VIEWED_VIDEO, RATE_LIMITED],
    hasPathParams: true,
  },
  {
    path: '/v1/me/events',
    method: 'get',
    expectedStatuses: [200, 401, 429],
    expectedErrorCodes: [UNAUTHORIZED, RATE_LIMITED],
  },
  {
    path: '/v1/videos/{id}/reprocess',
    method: 'post',
    expectedStatuses: [202, 400, 401, 403, 404, 429],
    expectedErrorCodes: [...OWNED_VIDEO, RATE_LIMITED],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/reactions',
    method: 'put',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: OWNED_VIDEO,
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/videos/{id}/reactions/me',
    method: 'get',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: VIEWED_VIDEO,
    hasPathParams: true,
  },
  {
    path: '/v1/feed',
    method: 'get',
    expectedStatuses: [200, 304, 400],
    expectedErrorCodes: [VALIDATION_FAILED],
    hasQueryParams: true,
  },
  { path: '/v1/categories', method: 'get', expectedStatuses: [200, 304] },
  {
    path: '/v1/me/account',
    method: 'get',
    expectedStatuses: [200, 401, 404],
    expectedErrorCodes: [UNAUTHORIZED, ErrorCodes.CHANNEL_NOT_FOUND],
  },
  {
    path: '/v1/me/channel',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 404, 409],
    expectedErrorCodes: [
      ...CHANNEL,
      ErrorCodes.HANDLE_ALREADY_TAKEN,
      ErrorCodes.INVALID_HANDLE_FORMAT,
    ],
    hasBody: true,
  },
  {
    path: '/v1/channels/{idOrHandle}',
    method: 'get',
    expectedStatuses: [200, 400, 404],
    expectedErrorCodes: [VALIDATION_FAILED, ErrorCodes.CHANNEL_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/channels/{id}/subscribers',
    method: 'post',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: [...CHANNEL, ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF],
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
    path: '/v1/me/subscriptions',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: AUTHENTICATED,
    hasQueryParams: true,
  },
  {
    path: '/v1/feed/subscriptions',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: AUTHENTICATED,
    hasQueryParams: true,
  },
  {
    path: '/v1/admin/videos/{id}',
    method: 'get',
    expectedStatuses: [200, 401, 403, 404],
    expectedErrorCodes: [...ADMIN, ErrorCodes.VIDEO_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/admin/categories',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 409],
    expectedErrorCodes: [VALIDATION_FAILED, ...ADMIN, ErrorCodes.CATEGORY_SLUG_CONFLICT],
    hasBody: true,
  },
  {
    path: '/v1/admin/categories/{id}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: [
      VALIDATION_FAILED,
      ...ADMIN,
      ErrorCodes.CATEGORY_NOT_FOUND,
      ErrorCodes.CATEGORY_SLUG_CONFLICT,
    ],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/admin/categories/{id}',
    method: 'delete',
    expectedStatuses: [204, 401, 403, 404, 409],
    expectedErrorCodes: [...ADMIN, ErrorCodes.CATEGORY_NOT_FOUND, ErrorCodes.CATEGORY_IN_USE],
    hasPathParams: true,
  },
  {
    path: '/v1/admin/dlq',
    method: 'get',
    expectedStatuses: [200, 401, 403],
    expectedErrorCodes: ADMIN,
    hasQueryParams: true,
  },
  {
    path: '/v1/admin/dlq/{id}/replay',
    method: 'post',
    expectedStatuses: [202, 400, 401, 403, 404],
    expectedErrorCodes: DLQ_ENTRY,
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/admin/dlq/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: DLQ_ENTRY,
    hasPathParams: true,
  },
  { path: '/healthz', method: 'get', expectedStatuses: [200] },
  { path: '/readyz', method: 'get', expectedStatuses: [200, 503] },
];
