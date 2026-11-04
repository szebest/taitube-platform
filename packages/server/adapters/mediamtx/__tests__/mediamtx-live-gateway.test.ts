import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { MediaMtxLiveGateway } from '../mediamtx-live-gateway';

const CONFIG = { apiUrl: 'http://mediamtx:9997', timeoutMs: 1000 };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function gateway(...responses: Response[]) {
  const send = vi.fn<typeof fetch>();
  for (const response of responses) send.mockResolvedValueOnce(response);
  return { send, gateway: new MediaMtxLiveGateway(CONFIG, send) };
}

const calledUrls = (send: ReturnType<typeof vi.fn<typeof fetch>>) =>
  send.mock.calls.map(([url]) => String(url));

describe('adapters/mediamtx: MediaMtxLiveGateway', () => {
  it.each([
    { scenario: 'a ready path', response: json({ ready: true, source: null }), publishing: true },
    {
      scenario: 'a path still connecting',
      response: json({ ready: false, source: null }),
      publishing: false,
    },
    { scenario: 'no such path', response: new Response(null, { status: 404 }), publishing: false },
  ])('reads $scenario as publishing=$publishing', async ({ response, publishing }) => {
    const { send, gateway: subject } = gateway(response);

    expect(expectOk(await subject.isPublishing('live/key'))).toBe(publishing);
    expect(calledUrls(send)).toEqual(['http://mediamtx:9997/v3/paths/get/live/key']);
  });

  it.each([
    { type: 'rtmpConn', collection: 'rtmpconns' },
    { type: 'webRTCSession', collection: 'webrtcsessions' },
  ])('kicks a $type publisher through /v3/$collection', async ({ type, collection }) => {
    const { send, gateway: subject } = gateway(
      json({ ready: true, source: { type, id: 'abc' } }),
      new Response(null, { status: 200 })
    );

    expectOk(await subject.kick('live/key'));

    expect(calledUrls(send)).toEqual([
      'http://mediamtx:9997/v3/paths/get/live/key',
      `http://mediamtx:9997/v3/${collection}/kick/abc`,
    ]);
    expect(send.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });

  it.each([
    { scenario: 'nobody publishing', response: new Response(null, { status: 404 }) },
    {
      scenario: 'a source it cannot kick',
      response: json({ ready: true, source: { type: 'hlsSource', id: 'x' } }),
    },
  ])('succeeds without a kick for $scenario', async ({ response }) => {
    const { send, gateway: subject } = gateway(response);

    expectOk(await subject.kick('live/key'));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    { scenario: 'an unreachable API', send: () => Promise.reject(new Error('ECONNREFUSED')) },
    { scenario: 'a 500', send: async () => new Response(null, { status: 500 }) },
    { scenario: 'a body it cannot read', send: async () => json({ unexpected: true }) },
  ])('reports $scenario as an unavailable gateway', async ({ send }) => {
    const subject = new MediaMtxLiveGateway(CONFIG, vi.fn<typeof fetch>(send));

    expect(expectErr(await subject.isPublishing('live/key')).code).toBe(
      ErrorCodes.LIVE_GATEWAY_UNAVAILABLE
    );
  });
});
