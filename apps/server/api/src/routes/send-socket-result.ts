import type { AnyFailure } from '@kit/errors';
import type { Result } from '@kit/result';
import type { FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { problemOf } from './send-result';

/**
 * `sendResult` for a socket already open (SDD ADR-24): no status line is left to set, so a failure
 * is an `error` frame carrying the same `Problem`, and the socket stays open. `ref` is the client's
 * id for the frame that failed.
 */
export function sendSocketResult<T, E extends AnyFailure>(
  socket: Pick<WebSocket, 'send'>,
  request: FastifyRequest,
  result: Result<T, E>,
  ref?: string
): void {
  const frame = result.ok
    ? result.value
    : {
        type: 'error',
        ...(ref === undefined ? {} : { ref }),
        problem: problemOf(request, result.error),
      };
  socket.send(JSON.stringify(frame));
}
