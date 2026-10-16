import { HttpNetworkFrame } from 'msw/experimental';
import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';

/** Where a mounted app exports its browser traces by default; it batches them, so one may land mid-spec. */
const LOCAL_TRACES_URL = 'http://localhost:4318/v1/traces';

export const apiServer = setupServer(
  http.post(LOCAL_TRACES_URL, () => new HttpResponse(null, { status: 200 }))
);

const unhandled: string[] = [];

export class UnhandledRequestError extends Error {
  constructor(requests: readonly string[]) {
    super(`No MSW handler answered: ${requests.join(', ')}`);
    this.name = 'UnhandledRequestError';
  }
}

function failOn(missed: readonly string[]): void {
  if (missed.length > 0) throw new UnhandledRequestError(missed);
}

export function listen(): void {
  apiServer.listen({
    onUnhandledFrame: ({ frame }) => {
      const what =
        frame instanceof HttpNetworkFrame
          ? `${frame.data.request.method} ${frame.data.request.url}`
          : `a ${frame.protocol} frame`;
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

export function endTest(): void {
  apiServer.resetHandlers();
  failOn(takeUnhandled());
}

export function endFile(): void {
  const missed = takeUnhandled();
  apiServer.close();
  failOn(missed);
}
