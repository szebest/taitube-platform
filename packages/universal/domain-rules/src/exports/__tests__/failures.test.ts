import { ErrorCodes } from '@vp/errors';
import { exportDailyLimit, exportInProgress, exportNotFound, exportTooLarge } from '../failures';

describe('@vp/domain-rules: export failures', () => {
  it.each([
    {
      failure: exportNotFound('e1'),
      expected: { code: ErrorCodes.EXPORT_NOT_FOUND, exportId: 'e1' },
    },
    { failure: exportInProgress(), expected: { code: ErrorCodes.EXPORT_IN_PROGRESS } },
    { failure: exportDailyLimit(), expected: { code: ErrorCodes.EXPORT_DAILY_LIMIT, limit: 10 } },
    {
      failure: exportTooLarge(),
      expected: { code: ErrorCodes.EXPORT_TOO_LARGE, maxRows: 1_000_000, maxBytes: 524_288_000 },
    },
  ])('$expected.code carries what the caller can act on', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
  });
});
