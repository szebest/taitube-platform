import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  FORBIDDEN,
  INVALID_CURSOR,
  CHANNEL_MEMBERSHIP_REQUIRED,
  EXPORT_NOT_FOUND,
  EXPORT_IN_PROGRESS,
  EXPORT_DAILY_LIMIT,
} = ErrorCodes;

const SCOPED = [UNAUTHORIZED, FORBIDDEN, CHANNEL_MEMBERSHIP_REQUIRED];

export const SDD_EXPORT_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/me/channel/exports',
    method: 'post',
    expectedStatuses: [202, 400, 401, 403, 409, 429],
    expectedErrorCodes: [...SCOPED, VALIDATION_FAILED, EXPORT_IN_PROGRESS, EXPORT_DAILY_LIMIT],
    hasBody: true,
  },
  {
    path: '/v1/me/channel/exports',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403],
    expectedErrorCodes: [...SCOPED, VALIDATION_FAILED, INVALID_CURSOR],
    hasQueryParams: true,
  },
  {
    path: '/v1/me/channel/exports/{id}',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403, 404],
    expectedErrorCodes: [...SCOPED, VALIDATION_FAILED, EXPORT_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/me/channel/exports/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: [...SCOPED, VALIDATION_FAILED, EXPORT_NOT_FOUND],
    hasPathParams: true,
  },
];
