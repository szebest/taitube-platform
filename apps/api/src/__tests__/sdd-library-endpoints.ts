import { ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const { VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, PLAYLIST_NOT_FOUND } = ErrorCodes;
const AUTHENTICATED = [VALIDATION_FAILED, UNAUTHORIZED];
const OWNED_PLAYLIST = [...AUTHENTICATED, FORBIDDEN, PLAYLIST_NOT_FOUND];
const IMMUTABLE = [...OWNED_PLAYLIST, ErrorCodes.SYSTEM_PLAYLIST_IMMUTABLE];

/** Playlists and watch history, SDD §6.1. */
export const SDD_LIBRARY_ENDPOINTS: SddEndpointContract[] = [
  {
    path: '/v1/playlists',
    method: 'post',
    expectedStatuses: [201, 400, 401, 422],
    expectedErrorCodes: AUTHENTICATED,
    hasBody: true,
  },
  {
    path: '/v1/playlists/{id}',
    method: 'get',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: [...AUTHENTICATED, PLAYLIST_NOT_FOUND],
    hasPathParams: true,
  },
  {
    path: '/v1/playlists/{id}',
    method: 'patch',
    expectedStatuses: [200, 400, 401, 403, 404, 422],
    expectedErrorCodes: IMMUTABLE,
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/playlists/{id}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: IMMUTABLE,
    hasPathParams: true,
  },
  {
    path: '/v1/playlists/{id}/items',
    method: 'post',
    expectedStatuses: [201, 400, 401, 403, 404],
    expectedErrorCodes: [...OWNED_PLAYLIST, ErrorCodes.VIDEO_NOT_FOUND],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/playlists/{id}/items/{videoId}',
    method: 'delete',
    expectedStatuses: [204, 400, 401, 403, 404],
    expectedErrorCodes: OWNED_PLAYLIST,
    hasPathParams: true,
  },
  {
    path: '/v1/playlists/{id}/reorder',
    method: 'put',
    expectedStatuses: [200, 400, 401, 403, 404, 409],
    expectedErrorCodes: [
      ...OWNED_PLAYLIST,
      ErrorCodes.PLAYLIST_ITEM_NOT_FOUND,
      ErrorCodes.VERSION_CONFLICT,
    ],
    hasBody: true,
    hasPathParams: true,
  },
  {
    path: '/v1/me/playlists',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: AUTHENTICATED,
    hasQueryParams: true,
  },
  {
    path: '/v1/me/history',
    method: 'post',
    expectedStatuses: [200, 400, 401, 404],
    expectedErrorCodes: [...AUTHENTICATED, ErrorCodes.VIDEO_NOT_FOUND],
    hasBody: true,
  },
  {
    path: '/v1/me/history',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: [...AUTHENTICATED, ErrorCodes.INVALID_CURSOR],
    hasQueryParams: true,
  },
  {
    path: '/v1/me/history',
    method: 'delete',
    expectedStatuses: [204, 401],
    expectedErrorCodes: [UNAUTHORIZED],
  },
  {
    path: '/v1/me/history/{videoId}',
    method: 'get',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: AUTHENTICATED,
    hasPathParams: true,
  },
  {
    path: '/v1/me/history/{videoId}',
    method: 'delete',
    expectedStatuses: [204, 400, 401],
    expectedErrorCodes: AUTHENTICATED,
    hasPathParams: true,
  },
];
