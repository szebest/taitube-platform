import { setupServer } from 'msw/node';

export const apiServer = setupServer();

const unhandled: string[] = [];

export class UnhandledRequestError extends Error {
  constructor(readonly requests: readonly string[]) {
    super(`No MSW handler answered: ${requests.join(', ')}`);
    this.name = 'UnhandledRequestError';
  }
}

/**
 * Starts intercepting. A request no handler answers never leaves the process: MSW answers it with
 * a 500, and it is remembered until `takeUnhandled` hands it over.
 */
export function listen(): void {
  apiServer.listen({
    onUnhandledRequest: (request) => {
      const described = `${request.method} ${request.url}`;
      unhandled.push(described);
      throw new UnhandledRequestError([described]);
    },
  });
}

export function takeUnhandled(): string[] {
  return unhandled.splice(0);
}

/** Drops the handlers a test added, and fails that test if it made a request nothing answered. */
export function endTest(): void {
  apiServer.resetHandlers();
  const missed = takeUnhandled();
  if (missed.length > 0) throw new UnhandledRequestError(missed);
}
