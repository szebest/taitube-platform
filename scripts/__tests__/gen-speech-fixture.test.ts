import { placeUtterances } from '../gen-speech-fixture';

describe('placeUtterances', () => {
  it('places the sentences one after another with a gap before each, cycling through them', () => {
    expect(placeUtterances([2000, 3000], 1000, 12_000)).toEqual([
      { sentence: 0, startMs: 1000, endMs: 3000 },
      { sentence: 1, startMs: 4000, endMs: 7000 },
      { sentence: 0, startMs: 8000, endMs: 10_000 },
    ]);
  });

  it('stops before an utterance that would not leave a gap after it', () => {
    const placed = placeUtterances([2000], 1000, 6000);

    expect(placed).toEqual([{ sentence: 0, startMs: 1000, endMs: 3000 }]);
  });

  it('places nothing when no sentence fits', () => {
    expect(placeUtterances([5000], 1000, 4000)).toEqual([]);
  });
});
