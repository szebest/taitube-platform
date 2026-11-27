import { readNsfw } from '../nsfw-finding';

const THRESHOLDS = { nsfwFrameThreshold: 0.85 };
const frames = (...scores: number[]) =>
  scores.map((score, index) => ({ timestampSeconds: index * 10, score }));

describe('readNsfw', () => {
  it.each([
    { scenario: 'no frame over the threshold', scores: [0.1, 0.84, 0.2], finding: null },
    { scenario: 'no frames at all', scores: [], finding: null },
    {
      scenario: 'one frame in four over it',
      scores: [0.1, 0.9, 0.2, 0.3],
      finding: { score: 0.9, share: 0.25, flagged: 1 },
    },
    {
      scenario: 'every frame over it',
      scores: [0.86, 0.99, 0.9],
      finding: { score: 0.99, share: 1, flagged: 3 },
    },
  ])('reads $scenario', ({ scores, finding }) => {
    const reading = readNsfw(frames(...scores), THRESHOLDS);

    expect(reading.finding).toEqual(
      finding && {
        reason: 'NSFW',
        score: finding.score,
        evidence: { share: finding.share, frames: scores.length, flagged: finding.flagged },
      }
    );
  });

  it('lists the flagged frames strongest first, the earlier moment first on a tie', () => {
    const { flagged } = readNsfw(frames(0.9, 0.99, 0.9, 0.1), THRESHOLDS);

    expect(flagged.map((frame) => frame.timestampSeconds)).toEqual([10, 0, 20]);
  });
});
