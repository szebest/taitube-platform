import { expect, test } from '../../../../../tests/playwright/fixtures';
import type { Persona } from '../../../../../tests/playwright/stack';

const NO_ID = '00000000-0000-7000-8000-000000000000';
const CHAPTERS = [
  { startMs: 0, title: 'Intro' },
  { startMs: 20_000, title: 'Middle' },
  { startMs: 60_000, title: 'End' },
];
const CARD = { startMs: 1_000, endMs: 4_000, text: 'A correction' };

type Attempt = {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: (videoId: string) => string;
  data?: Record<string, unknown>;
};

const ATTEMPTS: Attempt[] = [
  { name: 'read the history', method: 'GET', path: (id) => `/v1/creator/videos/${id}/revisions` },
  {
    name: 'restore a revision',
    method: 'POST',
    path: (id) => `/v1/creator/videos/${id}/revisions/${NO_ID}/restore`,
    data: { version: 1 },
  },
  {
    name: 'ask for chapter suggestions',
    method: 'GET',
    path: (id) => `/v1/creator/videos/${id}/chapter-suggestions`,
  },
  {
    name: 'replace the chapters',
    method: 'PUT',
    path: (id) => `/v1/videos/${id}/chapters`,
    data: { chapters: CHAPTERS, version: 1 },
  },
  {
    name: 'add a correction',
    method: 'POST',
    path: (id) => `/v1/videos/${id}/corrections`,
    data: CARD,
  },
  {
    name: 'change a correction',
    method: 'PATCH',
    path: (id) => `/v1/videos/${id}/corrections/${NO_ID}`,
    data: { text: 'Fixed' },
  },
  {
    name: 'remove a correction',
    method: 'DELETE',
    path: (id) => `/v1/videos/${id}/corrections/${NO_ID}`,
  },
];

const REFUSED: { caller: string; persona?: Persona; status: number; code: string }[] = [
  { caller: 'an anonymous caller', status: 401, code: 'UNAUTHORIZED' },
  { caller: 'a moderator of the channel', persona: 'moderator', status: 403, code: 'FORBIDDEN' },
  {
    caller: 'an analytics viewer of the channel',
    persona: 'analytics',
    status: 403,
    code: 'FORBIDDEN',
  },
  { caller: 'a viewer', persona: 'viewer', status: 403, code: 'FORBIDDEN' },
];

test.describe('video tools answer to the right to edit the video, with problem+json', () => {
  for (const { caller, persona, status, code } of REFUSED) {
    for (const attempt of ATTEMPTS) {
      test(`${caller} cannot ${attempt.name}`, async ({ api, stack }) => {
        const client = await api(persona, { channelId: stack.team.channelId });

        const response = await client.fetch(attempt.path(stack.videos.watchable.id), {
          method: attempt.method,
          data: attempt.data,
        });

        expect(response.status()).toBe(status);
        expect(response.headers()['content-type']).toContain('application/problem+json');
        expect(await response.json()).toMatchObject({ status, code });
      });
    }
  }

  test('an editor of the channel can add, change and remove a correction, and a bulk edit reports the moderator as refused', async ({
    api,
    stack,
  }) => {
    const editor = await api('editor', { channelId: stack.team.channelId });
    const moderator = await api('moderator', { channelId: stack.team.channelId });
    const videoId = stack.videos.clippable.id;

    const added = await editor.post(`/v1/videos/${videoId}/corrections`, { data: CARD });
    const cardUrl = `/v1/videos/${videoId}/corrections/${(await added.json()).id}`;
    const changed = await editor.patch(cardUrl, { data: { text: 'A better correction' } });
    const removed = await editor.delete(cardUrl);
    const bulk = await moderator.post('/v1/creator/videos/bulk', {
      data: { ids: [videoId], patch: { commentsEnabled: true } },
    });

    expect(added.status()).toBe(201);
    expect(changed.status()).toBe(200);
    expect((await changed.json()).text).toBe('A better correction');
    expect(removed.status()).toBe(204);
    expect(bulk.status()).toBe(200);
    expect((await bulk.json()).items).toEqual([{ id: videoId, ok: false, code: 'FORBIDDEN' }]);
  });
});
