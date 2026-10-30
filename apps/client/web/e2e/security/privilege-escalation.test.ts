import type { APIRequestContext } from '@playwright/test';
import { type Stack, expect, test } from '../../../../../tests/playwright/fixtures';

const CALLERS = [
  { caller: 'a normal user', persona: 'viewer', status: 403, code: 'FORBIDDEN' },
  { caller: 'an anonymous caller', persona: undefined, status: 401, code: 'UNAUTHORIZED' },
] as const;

type Caller = (typeof CALLERS)[number]['caller'];

type Attempt = {
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: (videoId: string, commentId: string) => string;
  data?: Record<string, unknown>;
  target?: keyof Stack['videos'];
  /** A comment on the target video, written by a viewer first, for a route that addresses one. */
  onComment?: true;
  /** Every caller unless named; a `/me` route only ever addresses the caller's own account. */
  callers?: readonly Caller[];
};

const ATTEMPTS: Attempt[] = [
  {
    name: "edit another creator's video",
    method: 'PATCH',
    path: (id) => `/v1/videos/${id}`,
    data: { title: 'hijacked', version: 1 },
  },
  { name: "delete another creator's video", method: 'DELETE', path: (id) => `/v1/videos/${id}` },
  {
    name: "reprocess another creator's video",
    method: 'POST',
    path: (id) => `/v1/videos/${id}/reprocess`,
    data: {},
  },
  {
    name: "edit another creator's video in the studio",
    method: 'PATCH',
    path: (id) => `/v1/creator/videos/${id}`,
    data: { title: 'hijacked', version: 1 },
  },
  {
    name: "delete another creator's video in the studio",
    method: 'DELETE',
    path: (id) => `/v1/creator/videos/${id}`,
  },
  {
    name: "read another creator's video analytics",
    method: 'GET',
    path: (id) => `/v1/creator/videos/${id}/analytics`,
  },
  {
    name: "read another creator's private video as an operator",
    method: 'GET',
    path: (id) => `/v1/admin/videos/${id}`,
    target: 'draft',
  },
  {
    name: "take another creator's video down",
    method: 'POST',
    path: (id) => `/v1/admin/videos/${id}/takedown`,
    data: { reason: 'hijacked' },
  },
  {
    name: "heart a comment on another creator's video",
    method: 'POST',
    path: (_, commentId) => `/v1/comments/${commentId}/heart`,
    onComment: true,
  },
  {
    name: "take the heart off a comment on another creator's video",
    method: 'DELETE',
    path: (_, commentId) => `/v1/comments/${commentId}/heart`,
    onComment: true,
  },
  { name: 'read the comment report queue', method: 'GET', path: () => '/v1/admin/reports' },
  {
    name: 'resolve a comment report',
    method: 'POST',
    path: () => '/v1/admin/reports/00000000-0000-7000-8000-000000000000/resolve',
    data: { resolution: 'removed' },
  },
  { name: 'list the dead letter queue', method: 'GET', path: () => '/v1/admin/dlq' },
  {
    name: 'create a category',
    method: 'POST',
    path: () => '/v1/admin/categories',
    data: { name: 'Hijacked', slug: 'hijacked' },
  },
  {
    name: 'read saved preferences',
    method: 'GET',
    path: () => '/v1/me/preferences',
    callers: ['an anonymous caller'],
  },
  {
    name: 'save preferences',
    method: 'PATCH',
    path: () => '/v1/me/preferences',
    data: { version: 0, privacy: { historyPaused: true } },
    callers: ['an anonymous caller'],
  },
  ...[
    { name: 'read the search history', method: 'GET', path: '/v1/me/searches' },
    { name: 'clear the search history', method: 'DELETE', path: '/v1/me/searches' },
    {
      name: "remove an entry of another user's search history",
      method: 'DELETE',
      path: '/v1/me/searches/00000000-0000-7000-8000-000000000000',
    },
    { name: 'read the liked videos', method: 'GET', path: '/v1/me/liked-videos' },
    { name: 'read the own comments', method: 'GET', path: '/v1/me/comments' },
  ].map(
    ({ name, method, path }): Attempt => ({
      name,
      method: method as Attempt['method'],
      path: () => path,
      callers: ['an anonymous caller'],
    })
  ),
];

async function commentOn(viewer: APIRequestContext, videoId: string): Promise<string> {
  const created = await viewer.post(`/v1/videos/${videoId}/comments`, {
    data: { content: 'a comment to be refused' },
  });
  return (await created.json()).id;
}

async function send(
  client: APIRequestContext,
  viewer: APIRequestContext,
  attempt: Attempt,
  stack: Stack
) {
  const video = stack.videos[attempt.target ?? 'watchable'];
  const commentId = attempt.onComment ? await commentOn(viewer, video.id) : '';
  return client.fetch(attempt.path(video.id, commentId), {
    method: attempt.method,
    data: attempt.data,
  });
}

test.describe('privilege escalation is refused with problem+json', () => {
  for (const { caller, persona, status, code } of CALLERS) {
    for (const attempt of ATTEMPTS.filter((row) => row.callers?.includes(caller) ?? true)) {
      test(`${caller} cannot ${attempt.name}`, async ({ api, stack }) => {
        const client = await api(persona);

        const response = await send(client, await api('viewer'), attempt, stack);

        expect(response.status()).toBe(status);
        expect(response.headers()['content-type']).toContain('application/problem+json');
        expect(await response.json()).toMatchObject({ status, code });
      });
    }
  }
});

test.describe("another user's search history stays out of reach", () => {
  test('a viewer cannot read, remove or clear what a creator searched', async ({ api }) => {
    const creator = await api('creator');
    const viewer = await api('viewer');
    expect((await creator.get('/v1/search?q=hijack')).status()).toBe(200);
    const [entry] = (await (await creator.get('/v1/me/searches')).json()).items;

    const listed = await (await viewer.get('/v1/me/searches')).json();
    const removed = await viewer.delete(`/v1/me/searches/${entry.id}`);
    const cleared = await viewer.delete('/v1/me/searches');

    expect(listed.items).not.toContainEqual(expect.objectContaining({ id: entry.id }));
    expect(removed.status()).toBe(404);
    expect(await removed.json()).toMatchObject({ code: 'SEARCH_HISTORY_NOT_FOUND' });
    expect(cleared.status()).toBe(204);
    expect((await (await creator.get('/v1/me/searches')).json()).items).toContainEqual(
      expect.objectContaining({ id: entry.id })
    );
  });
});
