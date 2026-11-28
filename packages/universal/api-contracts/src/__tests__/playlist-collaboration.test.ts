import {
  acceptPlaylistInvite,
  createPlaylistInviteLink,
  invitePlaylistCollaborator,
  leavePlaylist,
  removePlaylistCollaborator,
} from '../playlist-collaboration';

describe('packages/api-contracts: playlist collaboration', () => {
  it.each([
    {
      endpoint: invitePlaylistCollaborator,
      method: 'POST',
      path: '/v1/playlists/:id/collaborators',
    },
    { endpoint: leavePlaylist, method: 'DELETE', path: '/v1/playlists/:id/collaborators/me' },
    {
      endpoint: removePlaylistCollaborator,
      method: 'DELETE',
      path: '/v1/playlists/:id/collaborators/:userId',
    },
    { endpoint: acceptPlaylistInvite, method: 'POST', path: '/v1/playlist-invites/:token/accept' },
  ])('serves $method $path', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path });
  });

  it.each([
    { body: { role: 'editor', maxUses: null }, valid: true },
    { body: { role: 'editor', maxUses: 20, expiresInDays: 30 }, valid: true },
    { body: { role: 'editor', maxUses: 21 }, valid: false },
    { body: { role: 'editor', maxUses: null, expiresInDays: 31 }, valid: false },
    { body: { role: 'owner', maxUses: null }, valid: false },
  ])('takes the link $body: $valid', ({ body, valid }) => {
    expect(createPlaylistInviteLink.body.safeParse(body).success).toBe(valid);
  });
});
