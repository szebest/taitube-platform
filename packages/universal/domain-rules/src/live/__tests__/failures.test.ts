import { ErrorCodes } from '@vp/errors';
import { liveIngestRefused, liveStreamNotFound, liveStreamNotLive } from '../failures';

describe('@vp/domain-rules: live failures', () => {
  it.each([
    {
      failure: liveStreamNotFound('s1'),
      expected: { code: ErrorCodes.LIVE_STREAM_NOT_FOUND, liveStreamId: 's1' },
    },
    {
      failure: liveStreamNotLive('s1'),
      expected: { code: ErrorCodes.LIVE_STREAM_NOT_LIVE, liveStreamId: 's1' },
    },
    {
      failure: liveIngestRefused('reader'),
      expected: { code: ErrorCodes.LIVE_INGEST_REFUSED, reason: 'reader' },
    },
  ])('carries $expected.code', ({ failure, expected }) => {
    expect(failure).toMatchObject(expected);
  });
});
