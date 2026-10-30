import * as http from 'node:http';
import { Adapters } from '@vp/adapters/composition';
import { InMemoryStorageClient } from '@vp/adapters/in-memory';
import { PROBLEM_CONTENT_TYPE } from '@vp/api-contracts';
import { type AppConfigOverrides, inProcessAppConfig } from '@vp/env-schema';
import { type AdapterOverrides, composeApp } from '../app';
import { boundPort } from './bound-port';
import { bearer, TOKENS } from './test-app';

interface RawResponse {
  status: number | undefined;
  contentType: string | undefined;
  body: string;
}

/** Node frames a DELETE body only by its length, so without one the body reads as the next request. */
function deleteWithUnframedBody(port: number, path: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf-8');
        response.on('data', (chunk: string) => {
          body += chunk;
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode,
            contentType: response.headers['content-type'],
            body,
          })
        );
      }
    );
    request.on('error', reject);
    request.removeHeader('content-length');
    request.end('{}');
  });
}

const composeInProcess = async (
  overrides: AppConfigOverrides = {},
  adapters: AdapterOverrides = {}
) => {
  const config = inProcessAppConfig(overrides);
  return { config, ...(await composeApp({ config, adapters })) };
};

describe('apps/server/api: composeApp', () => {
  it('hands routes the services and the configuration it composed', async () => {
    const { config, app, container } = await composeInProcess({ cdn: 'http://cdn.composed' });

    expect(app.config).toBe(config);
    expect(app.services.videoService).toBeDefined();
    expect(container.get(Adapters.Config)).toBe(config);
    await app.close();
  });

  it('registers every plugin in the route table', async () => {
    const { app } = await composeInProcess();
    await app.ready();

    const registered = app.printRoutes({ commonPrefix: false });
    for (const path of ['/healthz', '/v1/uploads', '/v1/videos', '/admin/queues', '/v1/feed']) {
      expect(registered).toContain(path);
    }
    await app.close();
  });

  it('builds over an adapter a test hands it instead of the configured one', async () => {
    const storage = new InMemoryStorageClient();
    const { app, container } = await composeInProcess({}, { storage });

    expect(container.get(Adapters.Storage)).toBe(storage);
    await app.close();
  });

  it('disposes the container when the app closes, and leaves an override to its owner', async () => {
    const storage = new InMemoryStorageClient();
    const storageClose = vi.spyOn(storage, 'close');
    const { app, container } = await composeInProcess({}, { storage });
    const cacheClose = vi.spyOn(container.get(Adapters.Cache), 'close');

    await app.close();

    expect(cacheClose).toHaveBeenCalledTimes(1);
    expect(storageClose).not.toHaveBeenCalled();
  });

  it.each([
    { origin: 'http://localhost:5173', allowed: 'http://localhost:5173' },
    { origin: 'https://evil.example', allowed: undefined },
  ])('answers CORS for $origin with $allowed', async ({ origin, allowed }) => {
    const { app } = await composeInProcess({ http: { corsOrigins: ['http://localhost:5173'] } });

    const res = await app.inject({ method: 'GET', url: '/healthz', headers: { origin } });

    expect(res.headers['access-control-allow-origin']).toBe(allowed);
    await app.close();
  });

  it.each([
    { origin: 'http://localhost:5173', method: 'PATCH' },
    { origin: 'http://localhost:5174', method: 'POST' },
    { origin: 'http://localhost:8080', method: 'DELETE' },
  ])(
    'lets $origin preflight a $method carrying trace context, and cache the answer',
    async ({ origin, method }) => {
      const { app } = await composeInProcess();

      const res = await app.inject({
        method: 'OPTIONS',
        url: '/v1/me/channel',
        headers: {
          origin,
          'access-control-request-method': method,
          'access-control-request-headers': 'authorization,content-type,traceparent,tracestate',
        },
      });

      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-methods']).toContain(method);
      expect(res.headers['access-control-allow-headers']).toBe(
        'authorization,content-type,traceparent,tracestate'
      );
      expect(res.headers['access-control-max-age']).toBe('7200');
      expect(res.headers.vary).toContain('Origin');
      await app.close();
    }
  );

  it('answers a preflight from an origin it does not list without allowing it', async () => {
    const { app } = await composeInProcess();

    const res = await app.inject({
      method: 'OPTIONS',
      url: '/v1/me/channel',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'PATCH' },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  const MISSING_VIDEO = '/v1/videos/00000000-0000-7000-8000-000000000099';
  const WEB_ORIGIN = 'http://localhost:5173';

  it.each([
    {
      name: 'a body that is not JSON',
      method: 'POST',
      url: '/v1/uploads',
      contentType: 'application/json',
      payload: '{',
      status: 400,
      code: 'VALIDATION_FAILED',
    },
    {
      name: 'a JSON content type with no body',
      method: 'DELETE',
      url: MISSING_VIDEO,
      contentType: 'application/json',
      payload: '',
      status: 400,
      code: 'VALIDATION_FAILED',
    },
    {
      name: 'a media type no parser takes',
      method: 'POST',
      url: '/v1/uploads',
      contentType: 'application/xml',
      payload: '<upload/>',
      status: 415,
      code: 'UNSUPPORTED_CONTENT_TYPE',
    },
    {
      name: 'a body on a route that takes none',
      method: 'DELETE',
      url: MISSING_VIDEO,
      contentType: 'application/json',
      payload: '{}',
      status: 404,
      code: 'VIDEO_NOT_FOUND',
    },
    {
      name: 'a body over the configured limit',
      method: 'POST',
      url: '/v1/uploads',
      contentType: 'application/json',
      payload: JSON.stringify({ filename: 'x'.repeat(128) }),
      status: 413,
      code: 'VALIDATION_FAILED',
    },
    {
      name: 'a path that is not a valid URL',
      method: 'GET',
      url: '/v1/videos/%E0%A4%A',
      contentType: undefined,
      payload: undefined,
      status: 400,
      code: 'VALIDATION_FAILED',
    },
    {
      name: 'a route that does not exist',
      method: 'GET',
      url: '/v1/nope',
      contentType: undefined,
      payload: undefined,
      status: 404,
      code: 'ROUTE_NOT_FOUND',
    },
  ] as const)(
    'answers $name with a $status $code problem the web app can read',
    async ({ method, url, contentType, payload, status, code }) => {
      const { app } = await composeInProcess({ http: { bodyLimitBytes: 64 } });

      const res = await app.inject({
        method,
        url,
        headers: {
          ...bearer(TOKENS.user),
          origin: WEB_ORIGIN,
          ...(contentType ? { 'content-type': contentType } : {}),
        },
        payload,
      });

      expect(res.statusCode).toBe(status);
      expect(res.headers).toMatchObject({
        'content-type': PROBLEM_CONTENT_TYPE,
        'access-control-allow-origin': WEB_ORIGIN,
        'x-content-type-options': 'nosniff',
      });
      expect(res.json()).toMatchObject({ status, code, instance: url });
      await app.close();
    }
  );

  it('leaves an origin it does not list out of a bad URL problem', async () => {
    const { app } = await composeInProcess();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/%E0%A4%A',
      headers: { origin: 'https://evil.example' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers.vary).toContain('Origin');
    await app.close();
  });

  it('answers a request the HTTP parser rejects with a 400 problem', async () => {
    const { app } = await composeInProcess();
    await app.listen({ host: '127.0.0.1', port: 0 });

    const res = await deleteWithUnframedBody(boundPort(app.server), MISSING_VIDEO);

    expect(res.status).toBe(400);
    expect(res.contentType).toBe(PROBLEM_CONTENT_TYPE);
    expect(JSON.parse(res.body)).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    await app.close();
  });

  it.each([
    { proxy: 'a listed address', trustProxy: ['127.0.0.1'], remoteAddress: '127.0.0.1' },
    {
      proxy: 'an app server on the private network compose and the cluster give it',
      trustProxy: ['uniquelocal'],
      remoteAddress: '10.42.0.7',
    },
  ])(
    'takes the client address from the X-Forwarded-For of $proxy',
    async ({ trustProxy, remoteAddress }) => {
      const { app } = await composeInProcess({ http: { trustProxy } });
      app.get('/ip', async (request) => ({ ip: request.ip }));

      const res = await app.inject({
        method: 'GET',
        url: '/ip',
        remoteAddress,
        headers: { 'x-forwarded-for': '203.0.113.7' },
      });

      expect(res.json().ip).toBe('203.0.113.7');
      await app.close();
    }
  );

  it('ignores X-Forwarded-For from a proxy it was not told to trust', async () => {
    const { app } = await composeInProcess();
    app.get('/ip', async (request) => ({ ip: request.ip }));

    const res = await app.inject({
      method: 'GET',
      url: '/ip',
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });

    expect(res.json().ip).toBe('127.0.0.1');
    await app.close();
  });
});
