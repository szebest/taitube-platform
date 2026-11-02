import { HttpNetworkFrame } from 'msw/experimental';
import { setupServer } from 'msw/node';

import { endpointFor } from './endpoint-for';
import { sameOriginApiProxy } from './local-api';

export const apiServer = setupServer(sameOriginApiProxy);

const unhandled: string[] = [];

/** The ids of the requests MSW is still answering, so a test ends only once its own have settled. */
const inFlight: string[] = [];

const SETTLE_TIMEOUT_MS = 2_000;

export class UnhandledRequestError extends Error {
  constructor(requests: readonly string[]) {
    super(`No MSW handler answered: ${requests.join(', ')}`);
    this.name = 'UnhandledRequestError';
  }
}

function failOn(missed: readonly string[]): void {
  if (missed.length > 0) throw new UnhandledRequestError(missed);
}

function requestName(frame: unknown, protocol: string): string {
  if (!(frame instanceof HttpNetworkFrame)) return `a ${protocol} frame`;
  const { method, url } = frame.data.request;
  const endpoint = endpointFor(method, url);
  return `${method} ${url}${endpoint ? ` (mock it with mockEndpoint(${endpoint}, ...))` : ''}`;
}

export function listen(): void {
  apiServer.events.removeAllListeners();
  apiServer.events.on('request:start', ({ requestId }) => {
    inFlight.push(requestId);
  });
  apiServer.events.on('request:end', ({ requestId }) => {
    const at = inFlight.indexOf(requestId);
    if (at >= 0) inFlight.splice(at, 1);
  });
  apiServer.listen({
    onUnhandledFrame: ({ frame }) => {
      const what = requestName(frame, frame.protocol);
      const described = `${what} from "${expect.getState().currentTestName ?? 'no test'}"`;
      unhandled.push(described);
      // Throwing keeps the request in the process: MSW answers it with a 500 instead of sending it on.
      throw new UnhandledRequestError([described]);
    },
  });
}

export function takeUnhandled(): string[] {
  return unhandled.splice(0);
}

/**
 * Waits for the requests a test left in flight (a preload or a refetch still running as the test
 * unmounts) before dropping its handlers: dropped first, they reach the next test as unanswered.
 */
export async function endTest(): Promise<void> {
  const deadline = performance.now() + SETTLE_TIMEOUT_MS;
  await vi.waitFor(
    () => {
      if (inFlight.length > 0 && performance.now() < deadline) {
        throw new Error(`${inFlight.length} requests still in flight`);
      }
    },
    { timeout: 2 * SETTLE_TIMEOUT_MS }
  );
  apiServer.resetHandlers();
  failOn(takeUnhandled());
}

export function endFile(): void {
  const missed = takeUnhandled();
  apiServer.close();
  failOn(missed);
}
