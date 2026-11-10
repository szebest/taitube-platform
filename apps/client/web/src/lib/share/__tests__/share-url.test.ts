import { shareUrl } from '../share-url';

const ORIGIN = 'https://taitube.example';
const ID = '0190c3a0-5e1d-7000-8000-00000000a001';

describe('apps/client/web: shareUrl', () => {
  it.each([
    { scenario: 'a video', kind: 'watch', options: {}, expected: `${ORIGIN}/watch/${ID}` },
    {
      scenario: 'a video at a moment',
      kind: 'watch',
      options: { startAt: 75 },
      expected: `${ORIGIN}/watch/${ID}?t=75`,
    },
    {
      scenario: 'a video from the start',
      kind: 'watch',
      options: { startAt: 0 },
      expected: `${ORIGIN}/watch/${ID}`,
    },
    {
      scenario: 'a short, which has no start time',
      kind: 'shorts',
      options: { startAt: 12 },
      expected: `${ORIGIN}/shorts/${ID}`,
    },
    { scenario: 'a short', kind: 'shorts', options: {}, expected: `${ORIGIN}/shorts/${ID}` },
  ] as const)('builds the link to $scenario', ({ kind, options, expected }) => {
    expect(shareUrl(kind, ID, { origin: ORIGIN, ...options })).toBe(expected);
  });

  it('encodes an id that is not url safe', () => {
    expect(shareUrl('watch', 'a b/c', { origin: ORIGIN })).toBe(`${ORIGIN}/watch/a%20b%2Fc`);
  });
});
