import { matchFrames } from '../frame-match';
import { flip, hashAt, sampleOf, storedFrames } from './hashes';

const OPTIONS = { maxHamming: 3, intervalSeconds: 2 };
const CANDIDATE = Array.from({ length: 20 }, (_, i) => hashAt(i));
const stored = storedFrames('orig', CANDIDATE);
const unrelated = (count: number) =>
  Array.from({ length: count }, (_, i) => sampleOf(hashAt(i, 7)));

describe('@vp/fingerprint: matchFrames', () => {
  it.each([
    {
      name: 'an exact copy',
      frames: CANDIDATE.map((hash) => sampleOf(hash)),
      expected: {
        coverage: 1,
        longestRunSeconds: 40,
        runFromSeconds: 0,
        runToSeconds: 40,
        offsetSeconds: 0,
        mirrored: false,
      },
    },
    {
      name: 'a re-encode, a bit or two off per frame',
      frames: CANDIDATE.map((hash, i) => sampleOf(flip(hash, i % 2 === 0 ? [3] : [10, 40, 63]))),
      expected: { coverage: 1, longestRunSeconds: 40, offsetSeconds: 0, mirrored: false },
    },
    {
      name: 'a copy starting five frames in (trimmed start)',
      frames: CANDIDATE.slice(5).map((hash) => sampleOf(hash)),
      expected: { coverage: 1, longestRunSeconds: 30, offsetSeconds: 10, mirrored: false },
    },
    {
      name: 'a copy cut short at the end (trimmed end)',
      frames: CANDIDATE.slice(0, 16).map((hash) => sampleOf(hash)),
      expected: { coverage: 1, longestRunSeconds: 32, offsetSeconds: 0, mirrored: false },
    },
    {
      name: 'an excerpt of 7 of 20 frames inside unrelated footage',
      frames: [...CANDIDATE.slice(0, 7).map((hash) => sampleOf(hash)), ...unrelated(13)],
      expected: {
        coverage: 0.35,
        longestRunSeconds: 14,
        runFromSeconds: 0,
        runToSeconds: 14,
        offsetSeconds: 0,
      },
    },
    {
      name: 'a mirrored copy',
      frames: CANDIDATE.map((hash) => sampleOf(hashAt(0, 5), hash)),
      expected: { coverage: 1, longestRunSeconds: 40, mirrored: true },
    },
    {
      name: 'a copy with a mismatched frame in the middle',
      frames: CANDIDATE.map((hash, i) => sampleOf(i === 10 ? hashAt(0, 8) : hash)),
      expected: { coverage: 0.95, longestRunSeconds: 40, offsetSeconds: 0 },
    },
  ])('matches $name', ({ frames, expected }) => {
    const [match, ...rest] = matchFrames(frames, stored, OPTIONS);

    expect(rest).toEqual([]);
    expect(match).toMatchObject({ videoId: 'orig', ...expected });
  });

  it.each([
    { name: 'unrelated footage', frames: unrelated(20) },
    {
      name: 'a frame four bits away from every stored one',
      frames: CANDIDATE.map((hash) => sampleOf(flip(hash, [0, 17, 33, 50]))),
    },
    { name: 'no frames', frames: [] },
  ])('finds nothing in $name', ({ frames }) => {
    expect(matchFrames(frames, stored, OPTIONS)).toEqual([]);
  });

  it('reports each candidate video on its own alignment', () => {
    const other = storedFrames('other', CANDIDATE.slice(10).concat(CANDIDATE.slice(10)));
    const frames = CANDIDATE.slice(10).map((hash) => sampleOf(hash));

    const matches = matchFrames(frames, [...stored, ...other], OPTIONS);

    expect(matches.map((m) => [m.videoId, m.offsetSeconds, m.coverage]).sort()).toEqual([
      ['orig', 20, 1],
      ['other', 0, 1],
    ]);
  });

  it('uses the interval to turn positions into seconds', () => {
    const [match] = matchFrames(
      CANDIDATE.slice(2).map((hash) => sampleOf(hash)),
      stored,
      { maxHamming: 3, intervalSeconds: 5 }
    );

    expect(match).toMatchObject({ offsetSeconds: 10, longestRunSeconds: 90 });
  });
});
