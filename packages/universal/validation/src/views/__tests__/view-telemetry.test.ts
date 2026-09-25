import { expectErr, expectOk } from '@vp/testing/result';
import { qualifyView } from '../view-telemetry';

const LIMITS = { minWatchSeconds: 5 };
const SESSION = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('validation: qualifyView', () => {
  it.each([
    { watchSeconds: 5, videoDuration: 120, counted: 5 },
    { watchSeconds: 90, videoDuration: 120, counted: 90 },
    { watchSeconds: 3, videoDuration: 3, counted: 3 },
    { watchSeconds: 300, videoDuration: 120, counted: 120 },
  ])(
    'counts $watchSeconds s of a $videoDuration s video as $counted s',
    ({ watchSeconds, videoDuration, counted }) => {
      const view = expectOk(
        qualifyView({ sessionId: SESSION, watchSeconds, videoDuration }, LIMITS)
      );

      expect(view).toEqual({ sessionId: SESSION, watchSeconds: counted });
    }
  );

  it.each([
    { watchSeconds: 4.9, videoDuration: 120, requiredSeconds: 5 },
    { watchSeconds: 0, videoDuration: 120, requiredSeconds: 5 },
    { watchSeconds: 2, videoDuration: 3, requiredSeconds: 3 },
  ])(
    'discards $watchSeconds s of a $videoDuration s video',
    ({ watchSeconds, videoDuration, requiredSeconds }) => {
      const failure = expectErr(
        qualifyView({ sessionId: SESSION, watchSeconds, videoDuration }, LIMITS)
      );

      expect(failure).toMatchObject({ field: 'watchSeconds', watchSeconds, requiredSeconds });
    }
  );
});
