import { expectErr, expectOk } from '@vp/testing/result';
import { z } from 'zod';
import { createApi } from '../api';
import type { FetchPort } from '../ports';
import { createFakePorts } from './fake-ports';

const ACTOR = { id: 'user-1', role: 'creator' };
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

function apiWith(fetchPort: FetchPort) {
  const ports = createFakePorts({ fetch: fetchPort });
  return { ports, api: createApi(ports, 'http://api.test/') };
}

describe('seed/api: createApi', () => {
  it('signs in as the actor and sends JSON to the base url', async () => {
    const fetchPort = vi.fn<FetchPort>(async () => json({ id: 'a' }));
    const { api } = apiWith(fetchPort);

    const body = expectOk(
      await api.send(
        {
          actor: ACTOR,
          method: 'POST',
          path: '/v1/things',
          query: { page: 2 },
          json: { name: 'x' },
          channelId: 'c1',
        },
        z.object({ id: z.string() })
      )
    );

    expect(body).toEqual({ id: 'a' });
    const [url, init] = fetchPort.mock.calls[0] ?? [];
    expect(url).toBe('http://api.test/v1/things?page=2');
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer token:creator:user-1',
      'content-type': 'application/json',
      'x-channel-id': 'c1',
    });
    expect(init?.body).toBe('{"name":"x"}');
  });

  it('sends a text body with its own content type and reads an empty answer as nothing', async () => {
    const fetchPort = vi.fn<FetchPort>(async () => new Response(null, { status: 204 }));
    const { api } = apiWith(fetchPort);

    expectOk(
      await api.send(
        {
          actor: ACTOR,
          method: 'PUT',
          path: '/v1/x',
          text: { body: 'WEBVTT', contentType: 'text/vtt' },
        },
        z.unknown()
      )
    );

    expect(fetchPort.mock.calls[0]?.[1]).toMatchObject({
      body: 'WEBVTT',
      headers: { 'content-type': 'text/vtt' },
    });
  });

  it('waits and retries a 429, honouring Retry-After', async () => {
    const fetchPort = vi
      .fn<FetchPort>()
      .mockResolvedValueOnce(json({}, { status: 429, headers: { 'retry-after': '4' } }))
      .mockResolvedValueOnce(json({}, { status: 429 }))
      .mockResolvedValueOnce(json({ ok: true }));
    const { api, ports } = apiWith(fetchPort);

    expectOk(await api.send({ method: 'GET', path: '/v1/x' }, z.unknown()));

    expect(ports.slept).toEqual([4000, 4000]);
  });

  it('gives up on a 429 that never clears', async () => {
    const { api } = apiWith(async () => json({}, { status: 429 }));

    expect(expectErr(await api.send({ method: 'GET', path: '/v1/x' }, z.unknown()))).toMatchObject({
      kind: 'http',
      status: 429,
    });
  });

  it('turns a problem answer into a failure carrying its code', async () => {
    const { api } = apiWith(async () =>
      json({ code: 'VIDEO_NOT_FOUND', detail: 'no such video' }, { status: 404 })
    );

    expect(expectErr(await api.send({ method: 'GET', path: '/v1/videos/x' }, z.unknown()))).toEqual(
      {
        kind: 'http',
        method: 'GET',
        path: '/v1/videos/x',
        status: 404,
        message: 'VIDEO_NOT_FOUND: no such video',
      }
    );
  });

  it('keeps the start of a body that is not a problem document', async () => {
    const { api } = apiWith(async () => new Response('<html>bad gateway</html>', { status: 502 }));

    expect(expectErr(await api.send({ method: 'GET', path: '/v1/x' }, z.unknown()))).toMatchObject({
      status: 502,
      message: '<html>bad gateway</html>',
    });
  });

  it('reports a connection that fails as a network failure, not a throw', async () => {
    const { api } = apiWith(async () => {
      throw new Error('ECONNREFUSED');
    });

    expect(expectErr(await api.send({ method: 'GET', path: '/v1/x' }, z.unknown()))).toEqual({
      kind: 'network',
      method: 'GET',
      path: '/v1/x',
      message: 'ECONNREFUSED',
    });
  });

  it('rejects an answer that does not match the schema', async () => {
    const { api } = apiWith(async () => json({ id: 3 }));

    expect(
      expectErr(await api.send({ method: 'GET', path: '/v1/x' }, z.object({ id: z.string() })))
    ).toMatchObject({ kind: 'invalid' });
  });
});
