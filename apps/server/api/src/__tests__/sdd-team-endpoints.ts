import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  FORBIDDEN,
  INVALID_CURSOR,
  CHANNEL_NOT_FOUND,
  CHANNEL_MEMBERSHIP_REQUIRED,
  CHANNEL_INVITE_NOT_FOUND,
  CHANNEL_INVITE_NOT_PENDING,
  CHANNEL_INVITE_ALREADY_PENDING,
  CHANNEL_MEMBER_EXISTS,
  CHANNEL_MEMBER_NOT_FOUND,
  CHANNEL_OWNER_IMMUTABLE,
} = ErrorCodes;

const SCOPED = [UNAUTHORIZED, FORBIDDEN, CHANNEL_MEMBERSHIP_REQUIRED];
const ANSWER = [
  VALIDATION_FAILED,
  UNAUTHORIZED,
  FORBIDDEN,
  CHANNEL_INVITE_NOT_FOUND,
  CHANNEL_INVITE_NOT_PENDING,
];
const MEMBER_TARGETED = [
  ...SCOPED,
  VALIDATION_FAILED,
  CHANNEL_OWNER_IMMUTABLE,
  CHANNEL_MEMBER_NOT_FOUND,
];

export const SDD_TEAM_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/me/channel/members',
    method: 'get',
    expectedStatuses: [200, 401, 403],
    expectedErrorCodes: SCOPED,
  },
  {
    path: '/v1/me/channel/invites',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [
      ...SCOPED,
      VALIDATION_FAILED,
      CHANNEL_NOT_FOUND,
      CHANNEL_MEMBER_EXISTS,
      CHANNEL_INVITE_ALREADY_PENDING,
    ],
    hasBody: true,
  },
  {
    path: '/v1/me/channel/invites/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404, 409],
    expectedErrorCodes: [
      ...SCOPED,
      VALIDATION_FAILED,
      CHANNEL_INVITE_NOT_FOUND,
      CHANNEL_INVITE_NOT_PENDING,
    ],
    hasPathParams: true,
  },
  {
    path: '/v1/me/invites',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: [UNAUTHORIZED, VALIDATION_FAILED, INVALID_CURSOR],
    hasQueryParams: true,
  },
  {
    path: '/v1/invites/{id}/accept',
    method: 'post',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: ANSWER,
    hasPathParams: true,
  },
  {
    path: '/v1/invites/{id}/decline',
    method: 'post',
    expectedStatuses: [204, 400, 401, 403, 404, 409],
    expectedErrorCodes: ANSWER,
    hasPathParams: true,
  },
  {
    path: '/v1/me/channel/members/{userId}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404, 422],
    expectedErrorCodes: MEMBER_TARGETED,
    hasPathParams: true,
    hasBody: true,
  },
  {
    path: '/v1/me/channel/members/{userId}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: MEMBER_TARGETED,
    hasPathParams: true,
  },
  {
    path: '/v1/me/memberships',
    method: 'get',
    expectedStatuses: [200, 401],
    expectedErrorCodes: [UNAUTHORIZED],
  },
  {
    path: '/v1/me/channel/audit',
    method: 'get',
    expectedStatuses: [200, 400, 401, 403],
    expectedErrorCodes: [...SCOPED, VALIDATION_FAILED, INVALID_CURSOR],
    hasQueryParams: true,
  },
];
