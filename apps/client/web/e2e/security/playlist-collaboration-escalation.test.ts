import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '../../../../../tests/playwright/fixtures';

const NO_ID = '00000000-0000-7000-8000-000000000000';

type Attempt = {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: (playlistId: string, videoId: string) => string;
  data?: Record<string, unknown>;
  status: number;
  code: string;
};

/** What a contributor seated through a link still may not do on the creator's private playlist. */
const CONTRIBUTOR_ATTEMPTS: Attempt[] = [
  {
    name: 'remove an item the owner added',
    method: 'DELETE',
    path: (id, videoId) => `/v1/playlists/${id}/items/${videoId}`,
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'rename the playlist',
    method: 'PATCH',
    path: (id) => `/v1/playlists/${id}`,
    data: { title: 'hijacked' },
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'make the playlist public',
    method: 'PATCH',
    path: (id) => `/v1/playlists/${id}`,
    data: { visibility: 'public' },
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'invite someone else',
    method: 'POST',
    path: (id) => `/v1/playlists/${id}/invites`,
    data: { role: 'editor', maxUses: null },
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'restore a removed item',
    method: 'POST',
    path: (id) => `/v1/playlists/${id}/activity/${NO_ID}/restore`,
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'delete the playlist',
    method: 'DELETE',
    path: (id) => `/v1/playlists/${id}`,
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'read its stats',
    method: 'GET',
    path: (id) => `/v1/me/playlists/${id}/stats`,
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'pin it',
    method: 'PUT',
    path: (id) => `/v1/playlists/${id}/pin`,
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'hand out a share link',
    method: 'POST',
    path: (id) => `/v1/playlists/${id}/share-links`,
    data: { expiresIn: '30d' },
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    name: 'turn on removing watched videos',
    method: 'PATCH',
    path: (id) => `/v1/playlists/${id}`,
    data: { autoRemoveWatched: true },
    status: 403,
    code: 'FORBIDDEN',
  },
];

/** Someone with no seat learns nothing about the private playlist, not even that it exists. */
const STRANGER_ATTEMPTS: Attempt[] = [
  {
    name: 'read it',
    method: 'GET',
    path: (id) => `/v1/playlists/${id}`,
    status: 404,
    code: 'PLAYLIST_NOT_FOUND',
  },
  {
    name: 'read its activity',
    method: 'GET',
    path: (id) => `/v1/playlists/${id}/activity`,
    status: 404,
    code: 'PLAYLIST_NOT_FOUND',
  },
  {
    name: 'list its collaborators',
    method: 'GET',
    path: (id) => `/v1/playlists/${id}/collaborators`,
    status: 404,
    code: 'PLAYLIST_NOT_FOUND',
  },
  {
    name: 'add a video to it',
    method: 'POST',
    path: (id) => `/v1/playlists/${id}/items`,
    status: 404,
    code: 'PLAYLIST_NOT_FOUND',
  },
  {
    name: 'read its stats',
    method: 'GET',
    path: (id) => `/v1/me/playlists/${id}/stats`,
    status: 404,
    code: 'PLAYLIST_NOT_FOUND',
  },
  {
    name: 'list its share links',
    method: 'GET',
    path: (id) => `/v1/playlists/${id}/share-links`,
    status: 404,
    code: 'PLAYLIST_NOT_FOUND',
  },
  {
    name: 'fork it',
    method: 'POST',
    path: (id) => `/v1/playlists/${id}/fork`,
    status: 404,
    code: 'PLAYLIST_NOT_FOUND',
  },
];

async function sharedPlaylist(
  creator: APIRequestContext,
  contributor: APIRequestContext,
  videoId: string
) {
  const { id } = await (await creator.post('/v1/playlists', { data: { title: 'Ours' } })).json();
  await creator.post(`/v1/playlists/${id}/items`, { data: { videoId } });
  const link = await creator.post(`/v1/playlists/${id}/invites`, {
    data: { role: 'contributor', maxUses: 1 },
  });
  const { token } = await link.json();
  expect((await contributor.post(`/v1/playlist-invites/${token}/accept`)).status()).toBe(200);
  return { id, token };
}

test.describe('a playlist collaborator stays inside their role', () => {
  for (const attempt of CONTRIBUTOR_ATTEMPTS) {
    test(`a contributor cannot ${attempt.name}`, async ({ api, stack }) => {
      const videoId = stack.videos.watchable.id;
      const contributor = await api('viewer');
      const { id } = await sharedPlaylist(await api('creator'), contributor, videoId);

      const response = await contributor.fetch(attempt.path(id, videoId), {
        method: attempt.method,
        data: attempt.data,
      });

      expect(response.status()).toBe(attempt.status);
      expect(response.headers()['content-type']).toContain('application/problem+json');
      expect(await response.json()).toMatchObject({ code: attempt.code });
    });
  }

  for (const attempt of STRANGER_ATTEMPTS) {
    test(`a stranger cannot ${attempt.name}`, async ({ api, stack }) => {
      const videoId = stack.videos.watchable.id;
      const { id } = await sharedPlaylist(await api('creator'), await api('viewer'), videoId);

      const response = await (
        await api('stranger')
      ).fetch(attempt.path(id, videoId), {
        method: attempt.method,
        data: attempt.method === 'POST' ? { videoId } : attempt.data,
      });

      expect(response.status()).toBe(attempt.status);
      expect(await response.json()).toMatchObject({ code: attempt.code });
    });
  }

  test('a used-up or revoked invite link seats nobody', async ({ api, stack }) => {
    const creator = await api('creator');
    const stranger = await api('stranger');
    const { id, token } = await sharedPlaylist(
      creator,
      await api('viewer'),
      stack.videos.watchable.id
    );
    const revoked = await (
      await creator.post(`/v1/playlists/${id}/invites`, { data: { role: 'editor', maxUses: null } })
    ).json();
    await creator.delete(`/v1/playlists/${id}/invites/${revoked.id}`);

    const usedUp = await stranger.post(`/v1/playlist-invites/${token}/accept`);
    const ended = await stranger.post(`/v1/playlist-invites/${revoked.token}/accept`);

    expect([usedUp.status(), ended.status()]).toEqual([410, 410]);
    expect(await ended.json()).toMatchObject({ code: 'PLAYLIST_INVITE_INVALID' });
    expect((await stranger.get(`/v1/playlists/${id}`)).status()).toBe(404);
  });

  test('an anonymous caller cannot take an invite', async ({ api }) => {
    const response = await (await api()).post(`/v1/playlist-invites/${'t'.repeat(22)}/accept`);

    expect(response.status()).toBe(401);
  });

  test('a share link reads the private playlist until it is revoked, and grants nothing else', async ({
    api,
    stack,
  }) => {
    const creator = await api('creator');
    const stranger = await api('stranger');
    const { id } = await sharedPlaylist(creator, await api('viewer'), stack.videos.watchable.id);
    const link = await (
      await creator.post(`/v1/playlists/${id}/share-links`, { data: { expiresIn: '1h' } })
    ).json();

    const read = await stranger.get(`/v1/playlists/${id}?s=${link.token}`);
    const add = await stranger.post(`/v1/playlists/${id}/items?s=${link.token}`, {
      data: { videoId: stack.videos.watchable.id },
    });
    await creator.delete(`/v1/playlists/${id}/share-links/${link.id}`);
    const revoked = await stranger.get(`/v1/playlists/${id}?s=${link.token}`);

    expect([read.status(), add.status(), revoked.status()]).toEqual([200, 404, 410]);
    expect(await revoked.json()).toMatchObject({ code: 'SHARE_LINK_EXPIRED' });
  });
});
