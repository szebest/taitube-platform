import { expect, test } from '../../../../../tests/playwright/fixtures';

const ACCOUNT_ATTEMPTS = [
  {
    name: 'create a channel',
    method: 'POST',
    path: '/v1/me/channels',
    data: { handle: 'hijacked', displayName: 'Hijacked' },
  },
  {
    name: 'make a channel the primary one',
    method: 'PATCH',
    path: '/v1/me/channels/00000000-0000-7000-8000-000000000000',
    data: { isPrimary: true },
  },
  { name: 'list the identities', method: 'GET', path: '/v1/me/identities' },
  { name: 'read the sign-in history', method: 'GET', path: '/v1/me/security/sign-ins' },
] as const;

const PROMOTERS = [
  { caller: 'a normal user', persona: 'viewer' },
  { caller: 'a manager of the channel', persona: 'manager' },
] as const;

const ACTORS = [
  { caller: 'a user off the team', persona: 'viewer', code: 'CHANNEL_MEMBERSHIP_REQUIRED' },
  { caller: 'an editor of the channel', persona: 'editor', code: 'FORBIDDEN' },
] as const;

test.describe("another user's channel cannot be made the caller's primary or acted as", () => {
  for (const attempt of ACCOUNT_ATTEMPTS) {
    test(`an anonymous caller cannot ${attempt.name}`, async ({ api }) => {
      const client = await api(undefined);

      const response = await client.fetch(attempt.path, {
        method: attempt.method,
        data: 'data' in attempt ? attempt.data : undefined,
      });

      expect(response.status()).toBe(401);
      expect(await response.json()).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    });
  }

  for (const { caller, persona } of PROMOTERS) {
    test(`${caller} cannot promote the channel`, async ({ api, stack }) => {
      const client = await api(persona);

      const response = await client.patch(`/v1/me/channels/${stack.team.channelId}`, {
        data: { isPrimary: true },
      });

      expect(response.status()).toBe(403);
      expect(await response.json()).toMatchObject({ status: 403, code: 'CHANNEL_NOT_OWNED' });
    });
  }

  for (const { caller, persona, code } of ACTORS) {
    test(`${caller} cannot comment as the channel`, async ({ api, stack }) => {
      const client = await api(persona, { channelId: stack.team.channelId });

      const response = await client.post(`/v1/videos/${stack.videos.watchable.id}/comments`, {
        data: { content: 'as somebody else' },
      });

      expect(response.status()).toBe(403);
      expect(await response.json()).toMatchObject({ status: 403, code });
    });
  }
});
