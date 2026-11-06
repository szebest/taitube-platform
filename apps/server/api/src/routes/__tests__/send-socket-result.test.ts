import { liveStreamNotFound } from '@vp/domain-rules';
import { err, ok } from '@vp/result';
import type { WebSocket } from 'ws';
import { sendSocketResult } from '../send-socket-result';

function socket() {
  const sent: unknown[] = [];
  const fake: Pick<WebSocket, 'send'> = { send: (data) => sent.push(JSON.parse(String(data))) };
  return { fake, sent };
}

describe('apps/server/api/routes: sendSocketResult', () => {
  it('sends a value as the frame it is', () => {
    const { fake, sent } = socket();

    sendSocketResult(fake, '/v1/live/x/chat', ok({ type: 'ack', id: 'a1' }));

    expect(sent).toEqual([{ type: 'ack', id: 'a1' }]);
  });

  it('sends a failure as an error frame with its Problem and the ref of the frame that failed', () => {
    const { fake, sent } = socket();

    sendSocketResult(fake, '/v1/live/x/chat', err(liveStreamNotFound('x')), 'r1');

    expect(sent).toEqual([
      {
        type: 'error',
        ref: 'r1',
        problem: expect.objectContaining({
          status: 404,
          code: 'LIVE_STREAM_NOT_FOUND',
          instance: '/v1/live/x/chat',
        }),
      },
    ]);
  });
});
