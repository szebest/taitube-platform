import { CANONICAL_LADDER } from '@vp/job-contracts';
import { generateMasterPlaylist } from '../master';

const [LADDER_1080P, LADDER_720P, LADDER_480P] = CANONICAL_LADDER;

describe('packages/ffmpeg: generateMasterPlaylist', () => {
  it.each([
    { fps: 30, expected: ',FRAME-RATE=30.000,' },
    { fps: undefined, expected: 'RESOLUTION=1280x720,CODECS=' },
  ])('states FRAME-RATE only when the probe measured one ($fps)', ({ fps, expected }) => {
    expect(generateMasterPlaylist({ ladder: [LADDER_720P], fps })).toContain(expected);
  });

  it('generates master playlist matching SDD §8.4 with correct BANDWIDTH, RESOLUTION, and CODECS', () => {
    const singleVariant = generateMasterPlaylist({
      ladder: [LADDER_720P],
      fps: 24,
    });

    expect(singleVariant).toContain('#EXTM3U');
    expect(singleVariant).toContain('#EXT-X-VERSION:6');
    expect(singleVariant).toContain('#EXT-X-INDEPENDENT-SEGMENTS');
    expect(singleVariant).toContain(
      '#EXT-X-STREAM-INF:BANDWIDTH=2996000,AVERAGE-BANDWIDTH=2928000,RESOLUTION=1280x720,FRAME-RATE=24.000,CODECS="avc1.64001f,mp4a.40.2"'
    );
    expect(singleVariant).toContain('720p/index.m3u8');

    const multiVariant = generateMasterPlaylist({
      ladder: [LADDER_720P, LADDER_1080P],
      fps: 24,
    });
    const lines = multiVariant.split('\n');
    const firstStreamIdx = lines.findIndex((l) => l.includes('RESOLUTION=1920x1080'));
    const secondStreamIdx = lines.findIndex((l) => l.includes('RESOLUTION=1280x720'));
    expect(firstStreamIdx).toBeLessThan(secondStreamIdx);
  });

  it('generates master playlist with measured AVERAGE-BANDWIDTH when measuredResults provided', () => {
    const master = generateMasterPlaylist({
      ladder: [LADDER_1080P, LADDER_720P, LADDER_480P],
      fps: 24,
      measuredResults: {
        '1080p': { bytes: 5_000_000, durationMs: 10_000 },
        '720p': { avgBitrateBps: 2_500_000 },
      },
    });

    expect(master).toContain(
      '#EXT-X-STREAM-INF:BANDWIDTH=5350000,AVERAGE-BANDWIDTH=4000000,RESOLUTION=1920x1080,FRAME-RATE=24.000,CODECS="avc1.640029,mp4a.40.2"'
    );
    expect(master).toContain(
      '#EXT-X-STREAM-INF:BANDWIDTH=2996000,AVERAGE-BANDWIDTH=2500000,RESOLUTION=1280x720,FRAME-RATE=24.000,CODECS="avc1.64001f,mp4a.40.2"'
    );
    // No measurement for 480p: AVERAGE-BANDWIDTH falls back to (1400 + 96) kbps.
    expect(master).toContain(
      '#EXT-X-STREAM-INF:BANDWIDTH=1498000,AVERAGE-BANDWIDTH=1496000,RESOLUTION=854x480,FRAME-RATE=24.000,CODECS="avc1.4d401f,mp4a.40.2"'
    );

    const lines = master.split('\n');
    const idx1080 = lines.findIndex((l) => l.includes('1080p/index.m3u8'));
    const idx720 = lines.findIndex((l) => l.includes('720p/index.m3u8'));
    const idx480 = lines.findIndex((l) => l.includes('480p/index.m3u8'));
    expect(idx1080).toBeLessThan(idx720);
    expect(idx720).toBeLessThan(idx480);

    expect(master).toMatchInlineSnapshot(`
      "#EXTM3U
      #EXT-X-VERSION:6
      #EXT-X-INDEPENDENT-SEGMENTS
      #EXT-X-STREAM-INF:BANDWIDTH=5350000,AVERAGE-BANDWIDTH=4000000,RESOLUTION=1920x1080,FRAME-RATE=24.000,CODECS="avc1.640029,mp4a.40.2"
      1080p/index.m3u8
      #EXT-X-STREAM-INF:BANDWIDTH=2996000,AVERAGE-BANDWIDTH=2500000,RESOLUTION=1280x720,FRAME-RATE=24.000,CODECS="avc1.64001f,mp4a.40.2"
      720p/index.m3u8
      #EXT-X-STREAM-INF:BANDWIDTH=1498000,AVERAGE-BANDWIDTH=1496000,RESOLUTION=854x480,FRAME-RATE=24.000,CODECS="avc1.4d401f,mp4a.40.2"
      480p/index.m3u8
      "
    `);
  });

  it.each([
    ['high', '4.1', 'avc1.640029'],
    ['high', '3.1', 'avc1.64001f'],
    ['main', '3.1', 'avc1.4d401f'],
  ] as const)('writes %s@%s as the RFC 6381 codec %s', (profile, level, codec) => {
    const master = generateMasterPlaylist({
      ladder: [{ ...LADDER_720P, profile, level }],
      fps: 24,
    });

    expect(master).toContain(`CODECS="${codec},mp4a.40.2"`);
  });
});
