import { problemFor } from '@vp/api-contracts';
import type { AnyFailure } from '@vp/errors';
import type { Result } from '@vp/result';
import type { WebSocket } from 'ws';

/**
 * `sendResult` for a socket already open (SDD ADR-24): no status line is left to set, so a failure
 * is an `error` frame carrying the same `Problem`, and the socket stays open. `ref` is the client's
 * id for the frame that failed.
 */
export function sendSocketResult<T, E extends AnyFailure>(
  socket: Pick<WebSocket, 'send'>,
  path: string,
  result: Result<T, E>,
  ref?: string
): void {
  const frame = result.ok
    ? result.value
    : {
        type: 'error',
        ...(ref === undefined ? {} : { ref }),
        problem: problemFor(result.error, path),
      };
  socket.send(JSON.stringify(frame));
}
