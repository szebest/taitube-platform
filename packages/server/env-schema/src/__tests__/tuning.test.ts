import * as tuning from '../tuning';

function numbers(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  return typeof value === 'object' && value !== null ? Object.values(value).flatMap(numbers) : [];
}

describe('packages/env-schema: tuning', () => {
  it.each(Object.entries(tuning))('holds %s at positive, finite values', (_name, value) => {
    const values = numbers(value);

    expect(values.length).toBeGreaterThan(0);
    expect(values.filter((n) => !(Number.isFinite(n) && n > 0))).toEqual([]);
  });

  it('renews a captions step lease well before the stale-step poller would call it stuck', () => {
    expect(tuning.CAPTIONS_PROCESS.leaseRenewMs).toBeLessThan(tuning.POLLERS.staleStepMs / 2);
  });

  it('keeps the JWKS fetch timeout under the refetch interval, so a hung fetch cannot stack', () => {
    expect(tuning.JWKS_FETCH_TIMEOUT_MS).toBeLessThan(tuning.JWKS_REFETCH_INTERVAL_MS);
  });

  it('remembers an applied view batch far longer than a retried flush takes to reach it', () => {
    expect(tuning.VIEWS.batchRetentionMs).toBeGreaterThan(100 * tuning.VIEWS.flushIntervalMs);
  });

  it('abandons an UPLOADING video only once its session can no longer be resumed', () => {
    expect(tuning.HOUSEKEEPING.stuckUploadingAfterMs).toBe(
      tuning.UPLOAD_SESSION_TTL_SECONDS * 1000
    );
  });

  it.each([
    { name: 'a partial copy', lower: 'partialCoverage', upper: 'duplicateCoverage' },
    { name: 'a hold', lower: 'nsfwShareThreshold', upper: 'nsfwFrameThreshold' },
  ] as const)(
    'sets the bar for $name below the bar for the stronger finding',
    ({ lower, upper }) => {
      expect(tuning.SCREENING_THRESHOLDS[lower]).toBeLessThan(tuning.SCREENING_THRESHOLDS[upper]);
    }
  );

  it('keeps the audio index under 4000 rows for an hour of Chromaprint terms', () => {
    const termsPerHour = 3600 * 8.07;

    expect(termsPerHour / tuning.SCREENING_SAMPLING.audioIndexStride).toBeLessThan(4000);
  });
});
