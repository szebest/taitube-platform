import { inProcessAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { buildApp } from '../../app';
import { abortMidRequest } from './abort-mid-request';

async function loggedApp() {
  const log = captureLog();
  const app = await buildApp({
    config: inProcessAppConfig(),
    logger: createLogger({
      format: 'json',
      service: 'vp-api',
      level: 'info',
      destination: log.destination,
    }),
  });
  return { app, log };
}

describe('apps/api/plugins: access log', () => {
  it('writes one line per request with its method, route, status, duration and id', async () => {
    const { app, log } = await loggedApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/videos/0190a000-0000-7000-8000-00000000abcd',
      headers: { authorization: 'Bearer secret-token', 'x-request-id': 'req-from-edge' },
    });

    const lines = log.lines().filter((line) => line.msg === 'request completed');
    expect(lines).toEqual([
      expect.objectContaining({
        reqId: 'req-from-edge',
        method: 'GET',
        route: '/v1/videos/:id',
        status: res.statusCode,
        durationMs: expect.any(Number),
      }),
    ]);
    expect(res.headers['x-request-id']).toBe('req-from-edge');
    expect(log.text()).not.toContain('secret-token');
    await app.close();
  });

  it('names an unmatched path by what matched it, not by its URL', async () => {
    const { app, log } = await loggedApp();

    await app.inject({ method: 'GET', url: '/nothing/here?token=abc' });

    expect(log.lines().find((line) => line.msg === 'request completed')).toMatchObject({
      route: 'unmatched',
      status: 404,
    });
    expect(log.text()).not.toContain('token=abc');
    await app.close();
  });

  it('writes one line for a request the client hung up on, and no completed line', async () => {
    const { app, log } = await loggedApp();

    await abortMidRequest(app);
    await app.close();

    const lines = log.lines().filter((line) => line.route === '/hang');
    expect(lines).toEqual([
      expect.objectContaining({ msg: 'request aborted', method: 'GET', route: '/hang' }),
    ]);
  });

  it('logs an unhandled error once, with the request id, and answers a problem', async () => {
    const { app, log } = await loggedApp();
    app.get('/boom', async () => {
      throw new Error('kaboom');
    });

    const res = await app.inject({
      method: 'GET',
      url: '/boom',
      headers: { 'x-request-id': 'r-9' },
    });

    expect(res.statusCode).toBe(500);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ code: 'INTERNAL', status: 500 });
    expect(log.lines().filter((line) => line.level === 'error')).toEqual([
      expect.objectContaining({ reqId: 'r-9', msg: 'unhandled exception' }),
    ]);
    await app.close();
  });
});
