import { LOOKUP_BUDGET_MS, measureCatalogueLookup } from './catalogue-lookup';

/** The measurement behind the ticket's 200 ms figure. On demand: `pnpm --filter @vp/adapters test:perf`. */
describe('PostgresFingerprintRepository: lookup against a catalogue of 10 000 videos', () => {
  it('answers the frame and audio lookups of a new video within the budget', async () => {
    const { frameMs, audioMs, candidateFrames } = await measureCatalogueLookup(10_000);

    expect(frameMs, `frame lookup, ${candidateFrames} candidate rows`).toBeLessThan(
      LOOKUP_BUDGET_MS
    );
    expect(audioMs, 'audio lookup').toBeLessThan(LOOKUP_BUDGET_MS);
  }, 600_000);
});
