import { databaseUnavailable } from '@vp/errors';
import { err, ok } from '@vp/result';
import { failedResult, unwrapOrThrow } from '../queue-error';

describe('unwrapOrThrow', () => {
  it('hands back the value of a successful Result', () => {
    expect(unwrapOrThrow(ok({ videoId: 'v1' }))).toEqual({ videoId: 'v1' });
  });

  it('throws the class @vp/errors picks for the code, so the stage does not choose', () => {
    expect(() => unwrapOrThrow(err(databaseUnavailable('findById')))).toThrow(
      'Database unavailable'
    );
  });
});

describe('failedResult', () => {
  it('recognises a failed Result a converted stage returned', () => {
    expect(failedResult(err(databaseUnavailable('findById')))).toBe(true);
  });

  it.each([
    { name: 'a successful Result', outcome: ok({ videoId: 'v1' }) },
    { name: 'a plain stage return value', outcome: { videoId: 'v1', published: true } },
    { name: 'undefined', outcome: undefined },
    { name: 'null', outcome: null },
    { name: 'a string', outcome: 'done' },
    { name: 'a failure-shaped object with no code', outcome: { ok: false, error: {} } },
  ])('does not mistake $name for one', ({ outcome }) => {
    expect(failedResult(outcome)).toBe(false);
  });
});
