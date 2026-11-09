import { matchFinding } from '../match-finding';

const THRESHOLDS = { duplicateCoverage: 0.9 };
const match = (score: number) => ({
  videoId: 'original',
  score,
  video: {
    coverage: score,
    longestRunSeconds: 40,
    runFromSeconds: 0,
    runToSeconds: 40,
    offsetSeconds: 0,
    mirrored: false,
  },
  audio: null,
});

describe('matchFinding', () => {
  it.each([
    { scenario: 'a near-total copy', score: 0.95, status: 'READY', reason: 'DUPLICATE' },
    {
      scenario: 'a total copy of a video taken down',
      score: 1,
      status: 'REJECTED',
      reason: 'KNOWN_REJECTED',
    },
    {
      scenario: 'a part of a video taken down',
      score: 0.4,
      status: 'REJECTED',
      reason: 'PARTIAL_MATCH',
    },
    { scenario: 'a part of another video', score: 0.4, status: 'READY', reason: 'PARTIAL_MATCH' },
    { scenario: 'a copy right at the threshold', score: 0.9, status: 'READY', reason: 'DUPLICATE' },
  ])('files $scenario as $reason', ({ score, status, reason }) => {
    const finding = matchFinding(match(score), { ownerId: 'a', status }, 'b', THRESHOLDS);

    expect(finding).toMatchObject({ reason, score });
  });

  it.each([
    { ownerId: 'a', sameChannel: true },
    { ownerId: 'x', sameChannel: false },
  ])(
    'marks a match with the owner $ownerId as same-channel $sameChannel',
    ({ ownerId, sameChannel }) => {
      const finding = matchFinding(match(1), { ownerId, status: 'READY' }, 'a', THRESHOLDS);

      expect(finding.evidence).toMatchObject({ matchedVideoId: 'original', sameChannel });
    }
  );
});
