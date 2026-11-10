import { describeFailure, isUnsupported } from '../failure';
import type { SeedFailure } from '../failure';

const HTTP = { kind: 'http', method: 'GET', path: '/v1/x', status: 404, message: 'gone' } as const;

describe('seed/failure', () => {
  it.each<[SeedFailure, string]>([
    [HTTP, 'GET /v1/x answered 404: gone'],
    [
      { kind: 'network', method: 'PUT', path: '/v1/y', message: 'ECONNRESET' },
      'PUT /v1/y did not connect: ECONNRESET',
    ],
    [{ kind: 'process', message: 'ffmpeg exited 1' }, 'ffmpeg exited 1'],
    [{ kind: 'database', message: 'no DATABASE_URL' }, 'no DATABASE_URL'],
    [{ kind: 'timeout', message: 'too slow' }, 'too slow'],
    [{ kind: 'invalid', message: 'odd body' }, 'odd body'],
  ])('describes %j', (failure, text) => {
    expect(describeFailure(failure)).toBe(text);
  });

  it.each([
    { failure: HTTP, unsupported: true },
    { failure: { ...HTTP, status: 501 }, unsupported: true },
    { failure: { ...HTTP, status: 500 }, unsupported: false },
    { failure: { kind: 'timeout', message: 'x' } as const, unsupported: false },
  ])('knows whether $failure.kind $failure is a missing route', ({ failure, unsupported }) => {
    expect(isUnsupported(failure)).toBe(unsupported);
  });
});
