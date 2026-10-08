import { setupServer } from 'msw/node';

export const apiServer = setupServer();

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
    onUnhandledRequest: (request) => {
      const test = expect.getState().currentTestName ?? 'no test';
      const described = `${request.method} ${request.url} from "${test}"`;
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
