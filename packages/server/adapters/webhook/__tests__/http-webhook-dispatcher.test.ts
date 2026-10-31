import { expectErr, expectOk } from '@vp/testing/result';
import { HttpWebhookDispatcher, signWebhookBody } from '../http-webhook-dispatcher';

const NOW = Date.UTC(2026, 0, 1);
const delivery = {
  deliveryId: 'd-1',
  webhook: { id: 'w-1', url: 'https://hooks.example.com/in', secret: 'whsec' },
  event: 'video.ready' as const,
  payload: { videoId: 'v1' },
};

function dispatcher(send: typeof fetch, config = { timeoutMs: 1000, allowPrivateHosts: false }) {
  return new HttpWebhookDispatcher(config, send, () => NOW);
}

describe('adapters/webhook: HttpWebhookDispatcher', () => {
  it('posts the JSON body with the event, delivery, idempotency and signature headers', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));

    expectOk(await dispatcher(send).deliver(delivery));

    const timestamp = String(NOW / 1000);
    const body = JSON.stringify(delivery.payload);
    expect(send).toHaveBeenCalledWith(
      'https://hooks.example.com/in',
      expect.objectContaining({
        method: 'POST',
        redirect: 'manual',
        body,
        headers: expect.objectContaining({
          'x-taitube-event': 'video.ready',
          'x-taitube-delivery': 'd-1',
          'idempotency-key': 'd-1',
          'x-taitube-timestamp': timestamp,
          'x-taitube-signature-256': signWebhookBody('whsec', timestamp, body),
        }),
      })
    );
  });

  it('signs HMAC-SHA256 of the timestamp, a dot and the body', () => {
    expect(signWebhookBody('k', '1', '{}')).toBe(
      'sha256=3dd49b2593d0f9a349e9e71c4bde3e2b862c2be4003fe9b4ba81332029310158'
    );
  });

  it.each([
    { status: 301, code: 'WEBHOOK_DELIVERY_REJECTED', reason: 'redirect' },
    { status: 404, code: 'WEBHOOK_DELIVERY_REJECTED', reason: 'status' },
    { status: 429, code: 'WEBHOOK_DELIVERY_FAILED', reason: 'status' },
    { status: 503, code: 'WEBHOOK_DELIVERY_FAILED', reason: 'status' },
  ])('answers $status as $code ($reason)', async ({ status, code, reason }) => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));

    expect(expectErr(await dispatcher(send).deliver(delivery))).toMatchObject({
      code,
      reason,
      status,
    });
  });

  it('answers a receiver that never answers as a timeout', async () => {
    const send = vi.fn<typeof fetch>((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });

    const result = dispatcher(send, { timeoutMs: 5, allowPrivateHosts: false }).deliver(delivery);

    expect(expectErr(await result)).toMatchObject({
      code: 'WEBHOOK_DELIVERY_FAILED',
      reason: 'timeout',
    });
  });

  it('answers an unreachable receiver as a network failure', async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));

    expect(expectErr(await dispatcher(send).deliver(delivery))).toMatchObject({
      code: 'WEBHOOK_DELIVERY_FAILED',
      reason: 'network',
    });
  });

  it('refuses a private host without sending', async () => {
    const send = vi.fn<typeof fetch>();
    const local = { ...delivery, webhook: { ...delivery.webhook, url: 'https://127.0.0.1/in' } };

    expect(expectErr(await dispatcher(send).deliver(local))).toMatchObject({
      code: 'WEBHOOK_DELIVERY_REJECTED',
      reason: 'blocked-host',
    });
    expect(send).not.toHaveBeenCalled();
  });
});
