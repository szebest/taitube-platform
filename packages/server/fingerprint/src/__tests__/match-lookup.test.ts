import { databaseUnavailable } from '@vp/errors';
import { err } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { audioIndexTerms } from '../audio-terms';
import {
  type FingerprintMatchSettings,
  type NewVideoFingerprint,
  findMatches,
  storeFingerprint,
} from '../match-lookup';
import { FingerprintDouble } from './fingerprint-double';
import { hashAt, sampleOf } from './hashes';

const SETTINGS: FingerprintMatchSettings = {
  thresholds: {
    frameMaxHamming: 3,
    audioMaxBitErrorRate: 0.35,
    partialCoverage: 0.3,
    partialRunSeconds: 30,
  },
  hashIntervalSeconds: 2,
  audioIndexStride: 4,
  lookup: { minBandSetBits: 2, minTermSetBits: 4, maxHitsPerKey: 200 },
};

function term(i: number, family = 0): number {
  let x = i + 1 + family * 100_000;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) | 0;
}

const hashes = (count: number, family = 0) =>
  Array.from({ length: count }, (_, i) => hashAt(i, family));
const terms = (count: number, family = 0) =>
  Array.from({ length: count }, (_, i) => term(i, family));
const upload = (
  videoId: string,
  frameHashes: bigint[],
  audioTerms: number[]
): NewVideoFingerprint => ({
  videoId,
  frames: frameHashes.map((hash) => sampleOf(hash)),
  audioTerms,
});

const ORIGINAL = upload('orig', hashes(60), terms(480));

async function catalogue(...videos: NewVideoFingerprint[]) {
  const store = new FingerprintDouble();
  for (const video of videos) expectOk(await storeFingerprint(store, video, SETTINGS));
  return store;
}

describe('@vp/fingerprint: storeFingerprint', () => {
  it('stores every frame by position and every fourth audio term', async () => {
    const store = await catalogue(upload('v1', hashes(3), terms(9)));

    expect(store.frames.get('v1')).toEqual([0, 1, 2].map((idx) => ({ idx, hash: hashAt(idx) })));
    expect(store.audio.get('v1')).toEqual(audioIndexTerms(terms(9), 4));
  });

  it('stores an empty audio set for a video without sound', async () => {
    const store = await catalogue(upload('v1', hashes(3), []));

    expect(store.audio.get('v1')).toEqual([]);
  });

  it('stops at a failed frame write without storing the audio', async () => {
    const store = await catalogue();
    store.storeFrames = async () => err(databaseUnavailable.during('storeFrames')('down'));

    expectErr(await storeFingerprint(store, ORIGINAL, SETTINGS));
    expect(store.audio.size).toBe(0);
  });
});

describe('@vp/fingerprint: findMatches', () => {
  it.each([
    { name: 'the same upload again', query: upload('copy', hashes(60), terms(480)), score: 1 },
    {
      name: 'a copy trimmed by 20 percent at the end',
      query: upload('copy', hashes(48), terms(384)),
      score: 1,
    },
    {
      name: 'a copy that starts 20 frames in',
      query: upload('copy', hashes(60).slice(20), terms(480).slice(80)),
      score: 1,
    },
    {
      name: 'a 35 percent excerpt inside new footage',
      query: upload('copy', [...hashes(21), ...hashes(39, 7)], [...terms(168), ...terms(312, 7)]),
      score: 0.35,
    },
  ])('finds the original in $name', async ({ query, score }) => {
    const store = await catalogue(ORIGINAL);

    const [match, ...rest] = expectOk(await findMatches(store, query, SETTINGS));

    expect(rest).toEqual([]);
    expect(match?.videoId).toBe('orig');
    expect(match?.score).toBeCloseTo(score, 1);
    expect(match?.video).not.toBeNull();
    expect(match?.audio).not.toBeNull();
  });

  it('finds a mirrored copy by the frames alone', async () => {
    const store = await catalogue(ORIGINAL);
    const mirrored: NewVideoFingerprint = {
      videoId: 'copy',
      frames: hashes(60).map((hash) => sampleOf(hashAt(0, 5), hash)),
      audioTerms: terms(480),
    };

    const [match] = expectOk(await findMatches(store, mirrored, SETTINGS));

    expect(match?.video).toMatchObject({ coverage: 1, mirrored: true });
  });

  it('finds a copy whose audio was replaced, by the frames, and the reverse', async () => {
    const store = await catalogue(ORIGINAL);

    const [byFrames] = expectOk(
      await findMatches(store, upload('a', hashes(60), terms(480, 3)), SETTINGS)
    );
    const [byAudio] = expectOk(
      await findMatches(store, upload('b', hashes(60, 3), terms(480)), SETTINGS)
    );

    expect(byFrames).toMatchObject({ videoId: 'orig', score: 1 });
    expect(byFrames?.audio?.coverage ?? 0).toBeLessThan(0.1);
    expect(byAudio).toMatchObject({ videoId: 'orig', score: 1, video: null });
  });

  it.each([
    { name: 'unrelated footage', query: upload('new', hashes(60, 8), terms(480, 8)) },
    { name: 'a video without frames or audio', query: upload('new', [], []) },
    {
      name: 'an excerpt of 20 percent and 12 seconds',
      query: upload('new', [...hashes(6), ...hashes(24, 8)], [...terms(96), ...terms(384, 8)]),
    },
  ])('returns nothing for $name', async ({ query }) => {
    const store = await catalogue(ORIGINAL);

    expect(expectOk(await findMatches(store, query, SETTINGS))).toEqual([]);
  });

  it('keeps a short match that runs for the partial run length even under the coverage bar', async () => {
    const store = await catalogue(upload('orig', hashes(200), terms(1600)));
    const query = upload('new', [...hashes(16), ...hashes(184, 8)], terms(1600, 8));

    const [match] = expectOk(await findMatches(store, query, SETTINGS));

    expect(match?.score).toBeCloseTo(0.08, 2);
    expect(match?.video?.longestRunSeconds).toBe(32);
  });

  it('ranks the stronger of two candidates first and never reads back a video as its own match', async () => {
    const store = await catalogue(
      ORIGINAL,
      upload('half', hashes(30), terms(240)),
      upload('copy', hashes(60), terms(480))
    );

    const matches = expectOk(
      await findMatches(store, upload('copy', hashes(60), terms(480)), SETTINGS)
    );

    expect(matches.map((m) => [m.videoId, m.score])).toEqual([
      ['orig', 1],
      ['half', 0.5],
    ]);
  });

  it('hands the lookup limits to both the frame and the audio read', async () => {
    const store = await catalogue(ORIGINAL);

    expectOk(await findMatches(store, upload('copy', hashes(60), terms(480)), SETTINGS));

    expect(store.lookups).toEqual([SETTINGS.lookup, SETTINGS.lookup]);
  });

  it('fails with the repository failure, whichever read it was', async () => {
    const down = () => err(databaseUnavailable.during('read')('down'));
    for (const method of ['findFramesSharingBand', 'findAudioTerms', 'audioTermsOf'] as const) {
      const store = await catalogue(ORIGINAL);
      store[method] = async () => down();

      expectErr(await findMatches(store, upload('copy', hashes(60), terms(480)), SETTINGS));
    }
  });
});
