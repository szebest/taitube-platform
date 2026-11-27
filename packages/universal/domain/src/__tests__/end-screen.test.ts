import { endScreenStartWindow } from '../end-screen';

describe('@vp/domain: end-screen', () => {
  it.each([
    { durationMs: 600_000, expected: { earliest: 580_000, latest: 595_000 } },
    { durationMs: 12_000, expected: { earliest: 0, latest: 7_000 } },
    { durationMs: 3_000, expected: { earliest: 0, latest: 0 } },
  ])(
    'a $durationMs ms video starts its end screen inside $expected',
    ({ durationMs, expected }) => {
      expect(endScreenStartWindow(durationMs)).toEqual(expected);
    }
  );
});
