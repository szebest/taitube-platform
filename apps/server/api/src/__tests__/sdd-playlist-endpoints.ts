import { type ErrorCode, ErrorCodes } from '@vp/errors';
import type { SddEndpointContract } from './sdd-endpoint-contract';

const {
  VALIDATION_FAILED,
  UNAUTHORIZED,
  FORBIDDEN,
  PLAYLIST_NOT_FOUND,
  INVALID_CURSOR,
  PLAYLIST_ITEM_NOT_FOUND,
  PLAYLIST_COLLABORATOR_EXISTS,
  PLAYLIST_COLLABORATOR_LIMIT,
  PLAYLIST_COLLABORATOR_NOT_FOUND,
  PLAYLIST_INVITE_INVALID,
  PLAYLIST_ACTIVITY_NOT_FOUND,
  PLAYLIST_ACTIVITY_NOT_RESTORABLE,
  PLAYLIST_IS_SMART,
  PLAYLIST_NOT_SMART,
  PLAYLIST_PIN_LIMIT,
  SHARE_LINK_EXPIRED,
  SHARE_LINK_LIMIT,
  SHARE_LINK_NOT_FOUND,
  SYSTEM_PLAYLIST_IMMUTABLE,
} = ErrorCodes;
const ACTING = [VALIDATION_FAILED, UNAUTHORIZED, FORBIDDEN, PLAYLIST_NOT_FOUND];
const READING = [VALIDATION_FAILED, UNAUTHORIZED, PLAYLIST_NOT_FOUND];
const TAKING = [VALIDATION_FAILED, UNAUTHORIZED, PLAYLIST_INVITE_INVALID];
const ITEMS = [...ACTING, PLAYLIST_IS_SMART];
const OWNER_ONLY = [...ACTING, SYSTEM_PLAYLIST_IMMUTABLE];

type Shape = Pick<SddEndpointContract, 'hasBody' | 'hasPathParams' | 'hasQueryParams'>;

function row(
  method: SddEndpointContract['method'],
  path: string,
  expectedStatuses: number[],
  expectedErrorCodes: ErrorCode[],
  shape: Shape = {}
): SddEndpointContract {
  return { method, path, expectedStatuses, expectedErrorCodes, hasPathParams: true, ...shape };
}

const BODY = { hasBody: true };
const QUERY = { hasQueryParams: true };
const ID = '/v1/playlists/{id}';

/** The playlist collaboration, items, transfer and import routes, as SDD §6.1 lists them. */
export const SDD_PLAYLIST_ENDPOINTS: SddEndpointContract[] = [
  row(
    'get',
    `${ID}/items`,
    [200, 400, 401, 404, 410],
    [...READING, INVALID_CURSOR, SHARE_LINK_EXPIRED],
    QUERY
  ),
  row(
    'patch',
    `${ID}/items/{itemId}/annotation`,
    [204, 400, 401, 403, 404, 409, 422],
    [...ITEMS, PLAYLIST_ITEM_NOT_FOUND],
    BODY
  ),
  row('post', `${ID}/sections`, [201, 400, 401, 403, 404, 409, 422], ITEMS, BODY),
  row(
    'delete',
    `${ID}/sections/{itemId}`,
    [204, 400, 401, 403, 404, 409],
    [...ITEMS, PLAYLIST_ITEM_NOT_FOUND]
  ),
  row('post', `${ID}/sort`, [204, 400, 401, 403, 404, 409], ITEMS, BODY),
  row('get', `${ID}/collaborators`, [200, 400, 401, 403, 404], ACTING),
  row(
    'post',
    `${ID}/collaborators`,
    [201, 400, 401, 403, 404, 409],
    [
      ...ACTING,
      ErrorCodes.CHANNEL_NOT_FOUND,
      PLAYLIST_COLLABORATOR_EXISTS,
      PLAYLIST_COLLABORATOR_LIMIT,
    ],
    BODY
  ),
  row(
    'patch',
    `${ID}/collaborators/{userId}`,
    [204, 400, 401, 403, 404],
    [...ACTING, PLAYLIST_COLLABORATOR_NOT_FOUND],
    BODY
  ),
  row(
    'delete',
    `${ID}/collaborators/{userId}`,
    [204, 400, 401, 403, 404],
    [...ACTING, PLAYLIST_COLLABORATOR_NOT_FOUND]
  ),
  row(
    'delete',
    `${ID}/collaborators/me`,
    [204, 400, 401, 403, 404],
    [...ACTING, PLAYLIST_COLLABORATOR_NOT_FOUND]
  ),
  row(
    'post',
    `${ID}/invites`,
    [201, 400, 401, 403, 404, 409],
    [...ACTING, PLAYLIST_COLLABORATOR_LIMIT],
    BODY
  ),
  row('get', `${ID}/invites`, [200, 400, 401, 403, 404], ACTING),
  row('delete', `${ID}/invites/{inviteId}`, [204, 400, 401, 403, 404], ACTING),
  row(
    'post',
    '/v1/playlist-invites/{token}/accept',
    [200, 400, 401, 409, 410],
    [...TAKING, PLAYLIST_COLLABORATOR_EXISTS, PLAYLIST_COLLABORATOR_LIMIT]
  ),
  row('post', '/v1/playlist-invites/{token}/decline', [204, 400, 401, 410], TAKING),
  row('get', `${ID}/activity`, [200, 400, 401, 403, 404], [...ACTING, INVALID_CURSOR], QUERY),
  row(
    'post',
    `${ID}/activity/{activityId}/restore`,
    [204, 400, 401, 403, 404, 409],
    [...ITEMS, PLAYLIST_ACTIVITY_NOT_FOUND, PLAYLIST_ACTIVITY_NOT_RESTORABLE]
  ),
  row('post', `${ID}/items/transfer`, [200, 400, 401, 403, 404, 409, 422], ITEMS, BODY),
  row('post', `${ID}/duplicate`, [201, 400, 401, 403, 404, 422], ACTING, BODY),
  {
    method: 'post',
    path: '/v1/playlists/merge',
    expectedStatuses: [200, 400, 401, 403, 404, 409, 422],
    expectedErrorCodes: [...ITEMS, SYSTEM_PLAYLIST_IMMUTABLE],
    hasBody: true,
  },
  row('get', `${ID}/export`, [200, 400, 401, 404], READING, QUERY),
  row('post', `${ID}/import`, [200, 400, 401, 403, 404, 409, 422], ITEMS, BODY),
  row('put', `${ID}/pin`, [204, 400, 401, 403, 404, 409], [...ACTING, PLAYLIST_PIN_LIMIT]),
  row('delete', `${ID}/pin`, [204, 400, 401, 403, 404], ACTING),
  row('put', `${ID}/follow`, [204, 400, 401, 403, 404], ACTING),
  row('delete', `${ID}/follow`, [204, 400, 401], [VALIDATION_FAILED, UNAUTHORIZED]),
  {
    method: 'get',
    path: '/v1/me/playlists/following',
    expectedStatuses: [200, 400, 401],
    expectedErrorCodes: [VALIDATION_FAILED, UNAUTHORIZED, INVALID_CURSOR],
    hasQueryParams: true,
  },
  row('post', `${ID}/fork`, [201, 400, 401, 404], READING),
  row('post', `${ID}/freeze`, [201, 400, 401, 404, 409], [...READING, PLAYLIST_NOT_SMART]),
  row('get', `${ID}/share-links`, [200, 400, 401, 403, 404], OWNER_ONLY),
  row(
    'post',
    `${ID}/share-links`,
    [201, 400, 401, 403, 404, 409, 422],
    [...OWNER_ONLY, SHARE_LINK_LIMIT],
    BODY
  ),
  row(
    'delete',
    `${ID}/share-links/{linkId}`,
    [204, 400, 401, 403, 404],
    [...OWNER_ONLY, SHARE_LINK_NOT_FOUND]
  ),
  row('get', '/v1/me/playlists/{id}/stats', [200, 400, 401, 403, 404], ACTING, QUERY),
];
