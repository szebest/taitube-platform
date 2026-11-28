import { Container } from '@kit/composition';
import { err, ok } from '@kit/result';
import { liveStreamNotFound } from '@vp/domain-rules';
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { registerFailureWords } from '../../composition/failure-words.module';
import { Services } from '../../composition/service-tokens';
import { sendSocketResult } from '../send-socket-result';

function socket() {
  const sent: unknown[] = [];
  const fake: Pick<WebSocket, 'send'> = { send: (data: string) => sent.push(JSON.parse(data)) };
  return { fake, sent };
}

const request = {
  url: '/v1/live/x/chat',
  query: {},
  headers: { 'accept-language': 'pl' },
  server: {
    services: { failureWords: registerFailureWords(new Container()).get(Services.FailureWords) },
  },
} as unknown as FastifyRequest;

describe('apps/server/api/routes: sendSocketResult', () => {
  it('sends a value as the frame it is', () => {
    const { fake, sent } = socket();

    sendSocketResult(fake, request, ok({ type: 'ack', id: 'a1' }));

    expect(sent).toEqual([{ type: 'ack', id: 'a1' }]);
  });

  it('sends a failure as an error frame with its Problem, in the caller locale, and the ref of the frame that failed', () => {
    const { fake, sent } = socket();
    const failure = liveStreamNotFound('x');

    sendSocketResult(fake, request, err(failure), 'r1');

    expect(sent).toEqual([
      {
        type: 'error',
        ref: 'r1',
        problem: expect.objectContaining({
          status: 404,
          code: 'LIVE_STREAM_NOT_FOUND',
          instance: '/v1/live/x/chat',
          detail: request.server.services.failureWords.detail(failure, ['pl', 'en']),
        }),
      },
    ]);
  });
});
