import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '../fixtures';
import type { Stack } from '../stack';

type Attempt = {
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: (videoId: string) => string;
  data?: Record<string, unknown>;
  target?: keyof Stack['videos'];
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
  { name: 'list the dead letter queue', method: 'GET', path: () => '/v1/admin/dlq' },
  {
    name: 'create a category',
    method: 'POST',
    path: () => '/v1/admin/categories',
    data: { name: 'Hijacked', slug: 'hijacked' },
  },
];

const CALLERS = [
  { caller: 'a normal user', persona: 'viewer', status: 403, code: 'FORBIDDEN' },
  { caller: 'an anonymous caller', persona: undefined, status: 401, code: 'UNAUTHORIZED' },
] as const;

function send(client: APIRequestContext, attempt: Attempt, stack: Stack) {
  const video = stack.videos[attempt.target ?? 'watchable'];
  return client.fetch(attempt.path(video.id), { method: attempt.method, data: attempt.data });
}

test.describe('privilege escalation is refused with problem+json', () => {
  for (const { caller, persona, status, code } of CALLERS) {
    for (const attempt of ATTEMPTS) {
      test(`${caller} cannot ${attempt.name}`, async ({ api, stack }) => {
        const client = await api(persona);

        const response = await send(client, attempt, stack);

        expect(response.status()).toBe(status);
        expect(response.headers()['content-type']).toContain('application/problem+json');
        expect(await response.json()).toMatchObject({ status, code });
      });
    }
  }
});
