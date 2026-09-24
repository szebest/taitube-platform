import type { IncomingMessage } from 'node:http';
import type { InMemoryRepositories } from '@vp/adapters/in-memory';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import type { FastifyInstance } from 'fastify';
import { readSseUntil } from './sse-stream';
import { buildTestApp, seedVideo } from './test-app';

const OWNER = SEEDED.userId;
const PUBLIC_ID = '018f0000-0000-7000-8000-000000000061';
const UNLISTED_ID = '018f0000-0000-7000-8000-000000000062';
const PRIVATE_ID = '018f0000-0000-7000-8000-000000000063';

describe('apps/api anonymous video access', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let repositories: InMemoryRepositories;

  beforeAll(async () => {
    ({ app, repositories } = await buildTestApp());
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    await seedVideo(repositories, { id: PUBLIC_ID, ownerId: OWNER, title: 'Public Detail' });
    await seedVideo(repositories, {
      id: UNLISTED_ID,
      ownerId: OWNER,
      title: 'Unlisted Detail',
      visibility: 'unlisted',
    });
    await seedVideo(repositories, {
      id: PRIVATE_ID,
      ownerId: OWNER,
      title: 'Private Detail',
      visibility: 'private',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    { visibility: 'public', id: PUBLIC_ID, title: 'Public Detail' },
    { visibility: 'unlisted', id: UNLISTED_ID, title: 'Unlisted Detail' },
  ])('lets an anonymous caller read a $visibility video', async ({ id, title }) => {
    const res = await app.inject({ method: 'GET', url: `/v1/videos/${id}` });

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe(title);
  });

  it.each([`/v1/videos/${PRIVATE_ID}`, `/v1/videos/${PRIVATE_ID}/events`])(
    'answers an anonymous caller of the private %s with 401',
    async (url) => {
      const res = await app.inject({ method: 'GET', url });

      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe(ErrorCodes.UNAUTHORIZED);
    }
  );

  it('opens the event stream of a public video to an anonymous caller', async () => {
    let response: IncomingMessage | undefined;

    await readSseUntil(`${baseUrl}/v1/videos/${PUBLIC_ID}/events`, {
      onResponse: (res) => {
        response = res;
      },
      until: () => true,
    });

    expect(response?.statusCode).toBe(200);
    expect(response?.headers['content-type']).toBe('text/event-stream');
  });
});
