import * as http from 'node:http';
import { ErrorCodes } from '@vp/errors';
import { SEEDED } from '@vp/testing';
import type { FastifyInstance } from 'fastify';
import { TOKENS, buildTestApp, seedVideo } from '../../__tests__/test-app';

const OWNER = SEEDED.userId;
const PUBLIC_VIDEO = '018f0000-0000-7000-8000-000000000010';
const PRIVATE_VIDEO = '018f0000-0000-7000-8000-000000000020';
const ABSENT_VIDEO = '018f0000-0000-7000-8000-0000000000ff';

interface StreamHead {
  statusCode: number | undefined;
  headers: http.IncomingHttpHeaders;
  firstFrame: string;
}

function openStream(url: string, headers: http.OutgoingHttpHeaders = {}): Promise<StreamHead> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let received = '';
      res.on('data', (chunk) => {
        received += chunk.toString();
        if (received.includes('event: snapshot')) {
          req.destroy();
          resolve({ statusCode: res.statusCode, headers: res.headers, firstFrame: received });
        }
      });
      res.on('error', reject);
    });
    req.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'ECONNRESET') reject(error);
    });
  });
}

describe('SSE event routes', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  const strangerToken = TOKENS.otherUser;

  beforeAll(async () => {
    const testApp = await buildTestApp();
    app = testApp.app;
    for (const [id, visibility] of [
      [PUBLIC_VIDEO, 'public'],
      [PRIVATE_VIDEO, 'private'],
    ] as const) {
      await seedVideo(testApp.repositories, {
        id,
        ownerId: OWNER,
        title: `${visibility} video`,
        visibility,
        status: 'PROCESSING',
      });
    }
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    {
      refusal: 'a private video to an anonymous caller',
      url: `/v1/videos/${PRIVATE_VIDEO}/events`,
      headers: {},
      status: 401,
      code: ErrorCodes.UNAUTHORIZED,
    },
    {
      refusal: 'a private video to a stranger',
      url: `/v1/videos/${PRIVATE_VIDEO}/events`,
      headers: { authorization: `Bearer ${strangerToken}` },
      status: 404,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      refusal: 'an absent video',
      url: `/v1/videos/${ABSENT_VIDEO}/events`,
      headers: {},
      status: 404,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      refusal: 'the personal stream to an anonymous caller',
      url: '/v1/me/events',
      headers: {},
      status: 401,
      code: ErrorCodes.UNAUTHORIZED,
    },
  ])('refuses $refusal with a $status problem', async ({ url, headers, status, code }) => {
    const res = await app.inject({ method: 'GET', url, headers });

    expect(res.statusCode).toBe(status);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe(code);
  });

  it('answers 400 on a video id that is not a UUID', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/videos/not-a-uuid/events' });

    expect(res.statusCode).toBe(400);
  });

  it('opens a public video stream with SSE headers and a snapshot first', async () => {
    const stream = await openStream(`${baseUrl}/v1/videos/${PUBLIC_VIDEO}/events`);

    expect(stream.statusCode).toBe(200);
    expect(stream.headers['content-type']).toBe('text/event-stream');
    expect(stream.headers['cache-control']).toBe('no-cache');
    expect(stream.headers['x-accel-buffering']).toBe('no');
    expect(stream.firstFrame).toContain('event: snapshot\n');
    expect(stream.firstFrame).toContain(`"videoId":"${PUBLIC_VIDEO}"`);
  });

  it.each([
    { route: 'a public video stream', url: `/v1/videos/${PUBLIC_VIDEO}/events`, token: undefined },
    { route: 'the personal stream', url: '/v1/me/events', token: TOKENS.user },
  ])('keeps the CORS headers on $route for a listed origin', async ({ url, token }) => {
    const origin = 'http://localhost:4173';
    const auth = token ? { authorization: `Bearer ${token}` } : {};

    const stream = await openStream(`${baseUrl}${url}`, { origin, ...auth });

    expect(stream.statusCode).toBe(200);
    expect(stream.headers['access-control-allow-origin']).toBe(origin);
    expect(stream.headers.vary).toContain('Origin');
    expect(stream.headers['content-type']).toBe('text/event-stream');
  });
});
