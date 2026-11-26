import { expect, test } from '../../../../../tests/playwright/fixtures';
import type { Persona } from '../../../../../tests/playwright/stack';

const NO_ID = '00000000-0000-7000-8000-000000000000';
const TITLES = { kind: 'title', variants: [{ title: 'Control' }, { title: 'Challenger' }] };

type Attempt = {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: (videoId: string) => string;
  data?: Record<string, unknown>;
};

const ATTEMPTS: Attempt[] = [
  {
    name: 'list the share links',
    method: 'GET',
    path: (id) => `/v1/creator/videos/${id}/share-links`,
  },
  {
    name: 'create a share link',
    method: 'POST',
    path: (id) => `/v1/creator/videos/${id}/share-links`,
    data: { expiresIn: '1h' },
  },
  {
    name: 'revoke a share link',
    method: 'DELETE',
    path: (id) => `/v1/creator/videos/${id}/share-links/${NO_ID}`,
  },
  {
    name: 'set the password',
    method: 'PUT',
    path: (id) => `/v1/creator/videos/${id}/password`,
    data: { password: 'open sesame' },
  },
  {
    name: 'clear the password',
    method: 'DELETE',
    path: (id) => `/v1/creator/videos/${id}/password`,
  },
  { name: 'list the tests', method: 'GET', path: (id) => `/v1/creator/videos/${id}/experiments` },
  {
    name: 'start a test',
    method: 'POST',
    path: (id) => `/v1/creator/videos/${id}/experiments`,
    data: TITLES,
  },
  {
    name: 'stop a test',
    method: 'POST',
    path: (id) => `/v1/creator/videos/${id}/experiments/${NO_ID}/stop`,
  },
  {
    name: 'apply a test',
    method: 'POST',
    path: (id) => `/v1/creator/videos/${id}/experiments/${NO_ID}/apply`,
    data: { variantId: 'a', version: 1 },
  },
];

type Refusal = {
  caller: string;
  persona?: Persona;
  video: 'watchable' | 'draft';
  status: number;
  code: string;
};

const REFUSED: Refusal[] = [
  { caller: 'an anonymous caller', video: 'watchable', status: 401, code: 'UNAUTHORIZED' },
  {
    caller: 'a moderator of the channel',
    persona: 'moderator',
    video: 'watchable',
    status: 403,
    code: 'FORBIDDEN',
  },
  {
    caller: 'an analytics viewer of the channel',
    persona: 'analytics',
    video: 'watchable',
    status: 403,
    code: 'FORBIDDEN',
  },
  { caller: 'a stranger', persona: 'viewer', video: 'draft', status: 404, code: 'VIDEO_NOT_FOUND' },
];

test.describe('share links, passwords and tests answer to the right to edit the video', () => {
  for (const { caller, persona, video, status, code } of REFUSED) {
    for (const attempt of ATTEMPTS) {
      test(`${caller} cannot ${attempt.name}`, async ({ api, stack }) => {
        const client = await api(persona, { channelId: stack.team.channelId });

        const response = await client.fetch(attempt.path(stack.videos[video].id), {
          method: attempt.method,
          data: attempt.data,
        });

        expect(response.status()).toBe(status);
        expect(response.headers()['content-type']).toContain('application/problem+json');
        expect(await response.json()).toMatchObject({ status, code });
      });
    }
  }

  test('an editor of the channel can share, clear a password, and run and apply a test', async ({
    api,
    stack,
  }) => {
    const editor = await api('editor', { channelId: stack.team.channelId });
    const { id: videoId, title } = stack.videos.clippable;
    const links = `/v1/creator/videos/${videoId}/share-links`;
    const tests = `/v1/creator/videos/${videoId}/experiments`;

    const link = await editor.post(links, { data: { expiresIn: '1h', label: 'Escalation' } });
    const listed = await editor.get(links);
    const revoked = await editor.delete(`${links}/${(await link.json()).id}`);
    const cleared = await editor.delete(`/v1/creator/videos/${videoId}/password`);
    const started = await editor.post(tests, {
      data: { kind: 'title', variants: [{ title }, { title: `${title} again` }] },
    });
    const { version } = await (await editor.get(`/v1/videos/${videoId}`)).json();
    const applied = await editor.post(`${tests}/${(await started.json()).id}/apply`, {
      data: { variantId: 'a', version },
    });

    expect(link.status()).toBe(201);
    expect(listed.status()).toBe(200);
    expect(revoked.status()).toBe(204);
    expect(cleared.status()).toBe(204);
    expect(started.status()).toBe(201);
    expect(applied.status()).toBe(200);
    expect((await applied.json()).title).toBe(title);
  });
});
