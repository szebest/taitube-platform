import { expect, test } from '../../../../../tests/playwright/fixtures';
import type { Persona } from '../../../../../tests/playwright/stack';

const FILE = { filename: 'retake.mp4', sizeBytes: 1_000, contentType: 'video/mp4' };
const TRIM = { trim: { startMs: 0, endMs: 2_000 }, blurs: [] };

type Attempt = {
  name: string;
  method: 'GET' | 'POST' | 'PUT';
  path: (videoId: string) => string;
  data?: Record<string, unknown>;
};

const ATTEMPTS: Attempt[] = [
  {
    name: 'read the generations',
    method: 'GET',
    path: (id) => `/v1/creator/videos/${id}/generations`,
  },
  {
    name: 'replace the file',
    method: 'POST',
    path: (id) => `/v1/videos/${id}/replacement`,
    data: FILE,
  },
  {
    name: 'render a replacement',
    method: 'POST',
    path: (id) => `/v1/videos/${id}/replacement/complete`,
    data: { generation: 2 },
  },
  { name: 'trim and blur', method: 'PUT', path: (id) => `/v1/videos/${id}/edits`, data: TRIM },
  {
    name: 'revert the edits',
    method: 'POST',
    path: (id) => `/v1/videos/${id}/edits/revert`,
    data: { version: 1 },
  },
  {
    name: 'ask for clip suggestions',
    method: 'GET',
    path: (id) => `/v1/creator/videos/${id}/clip-suggestions`,
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

test.describe('replacing, trimming and clip suggestions answer to the right to edit the video', () => {
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

  test('an editor of the channel gets past the permission on every one of them', async ({
    api,
    stack,
  }) => {
    const editor = await api('editor', { channelId: stack.team.channelId });
    const videoId = stack.videos.watchable.id;

    const listed = await editor.get(`/v1/creator/videos/${videoId}/generations`);
    const suggested = await editor.get(`/v1/creator/videos/${videoId}/clip-suggestions`);
    const outside = await editor.put(`/v1/videos/${videoId}/edits`, {
      data: { trim: { startMs: 0, endMs: 999_999_999 }, blurs: [] },
    });
    const reverted = await editor.post(`/v1/videos/${videoId}/edits/revert`, {
      data: { version: 1 },
    });
    const completed = await editor.post(`/v1/videos/${videoId}/replacement/complete`, {
      data: { generation: 99 },
    });

    expect([listed.status(), suggested.status()]).toEqual([200, 200]);
    expect([outside.status(), (await outside.json()).code]).toEqual([422, 'VALIDATION_FAILED']);
    expect((await reverted.json()).code).toBe('NO_EDIT_TO_REVERT');
    expect((await completed.json()).code).toBe('REPLACEMENT_NOT_UPLOADED');
  });
});
