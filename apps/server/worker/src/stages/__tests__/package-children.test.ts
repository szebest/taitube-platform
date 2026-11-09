import { readChildren } from '../package-children';

const transcode = (rendition: string) => ({
  type: 'transcode',
  rendition,
  playlistKey: `k/${rendition}`,
  segmentCount: 3,
  bytes: 1000,
  durationMs: 9000,
  avgBitrateBps: 2_000_000,
  processingMs: 5,
});
const thumbnail = { type: 'thumbnail', posterKey: 'p', spriteKey: 's', spriteVttKey: 'v' };
const screen = {
  type: 'screen',
  screeningId: '0190e8a0-0000-7000-8000-000000000001',
  outcome: 'HOLD',
  score: 0.9,
  reasons: ['BLANK'],
};

describe('readChildren', () => {
  it('sorts each child result by the stage that wrote it', () => {
    const children = readChildren({
      a: transcode('720p'),
      b: transcode('480p'),
      c: thumbnail,
      d: screen,
    });

    expect(Object.keys(children.measured)).toEqual(['720p', '480p']);
    expect(children.measured['720p']).toEqual({
      bytes: 1000,
      durationMs: 9000,
      avgBitrateBps: 2_000_000,
    });
    expect(children.thumbnail).toMatchObject({ posterKey: 'p' });
    expect(children.screen).toMatchObject({ outcome: 'HOLD', reasons: ['BLANK'] });
  });

  it.each([
    { scenario: 'no children', values: {} },
    {
      scenario: 'a value that is no child result',
      values: { x: { type: 'other' }, y: 'text', z: null },
    },
  ])('finds nothing in $scenario', ({ values }) => {
    expect(readChildren(values)).toEqual({ measured: {}, thumbnail: undefined, screen: undefined });
  });
});
