import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import type { LadderEntry } from '@vp/job-contracts';
import {
  buildTranscodeArgs,
  classifyFfmpegError,
  generateMasterPlaylist,
  getAvcCodecString,
} from '../index';

describe('packages/ffmpeg transcode & master playlist (Ticket 07: AC 18, 23)', () => {
  const ladder720p: LadderEntry = {
    name: '720p',
    width: 1280,
    height: 720,
    videoKbps: 2800,
    maxrateKbps: 2996,
    bufsizeKbps: 4200,
    audioKbps: 128,
    profile: 'high',
    level: '3.1',
  };

  const ladder1080p: LadderEntry = {
    name: '1080p',
    width: 1920,
    height: 1080,
    videoKbps: 5000,
    maxrateKbps: 5350,
    bufsizeKbps: 7500,
    audioKbps: 128,
    profile: 'high',
    level: '4.1',
  };

  it('AC 18: buildTranscodeArgs derives GOP = round(2 * fps) and enforces SDD §8.2 flags', () => {
    // 24 fps -> gop 48
    const args24 = buildTranscodeArgs({
      sourcePath: '/tmp/source.mp4',
      outputDir: '/tmp/out-720p',
      rendition: ladder720p,
      fps: 24,
      threads: 2,
      preset: 'veryfast',
    });

    expect(args24).toContain('-hide_banner');
    expect(args24).toContain('-nostdin');
    expect(args24).toContain('pipe:1');
    expect(args24).toContain(
      'scale=w=1280:h=720:force_original_aspect_ratio=decrease:force_divisible_by=2'
    );
    expect(args24).toContain('-preset');
    expect(args24).toContain('veryfast');
    expect(args24).toContain('-profile:v');
    expect(args24).toContain('high');
    expect(args24).toContain('-level');
    expect(args24).toContain('3.1');
    expect(args24).toContain('2800k');
    expect(args24).toContain('2996k');
    expect(args24).toContain('4200k');

    // Keyframe alignment
    const gIndex24 = args24.indexOf('-g');
    expect(gIndex24).toBeGreaterThan(-1);
    expect(args24[gIndex24 + 1]).toBe('48');
    const minGIndex24 = args24.indexOf('-keyint_min');
    expect(args24[minGIndex24 + 1]).toBe('48');
    expect(args24).toContain('expr:gte(t,n_forced*2)');

    // HLS parameters
    expect(args24).toContain('-hls_time');
    const timeIndex = args24.indexOf('-hls_time');
    expect(args24[timeIndex + 1]).toBe('6');
    expect(args24).toContain('independent_segments+temp_file');
    expect(args24).toContain('mpegts');

    // 29.97 fps -> round(2 * 29.97) = 60
    const args30 = buildTranscodeArgs({
      sourcePath: '/tmp/source.mp4',
      outputDir: '/tmp/out-720p',
      rendition: ladder720p,
      fps: 29.97,
      threads: 2,
      preset: 'veryfast',
    });
    const gIndex30 = args30.indexOf('-g');
    expect(args30[gIndex30 + 1]).toBe('60');
  });

  it('AC 23: classifyFfmpegError classifies exit 137, timeout, and corrupt containers accurately', () => {
    // Exit 137 = OOM (TransientError)
    const oomErr = classifyFfmpegError(137, null, 'Killed');
    expect(oomErr).toBeInstanceOf(TransientError);
    expect((oomErr as TransientError).code).toBe(ErrorCodes.FFMPEG_OOM);

    // Timeout (SIGTERM / SIGALRM) (TransientError)
    const timeoutErr = classifyFfmpegError(null, 'SIGTERM', 'Terminated');
    expect(timeoutErr).toBeInstanceOf(TransientError);
    expect((timeoutErr as TransientError).code).toBe(ErrorCodes.FFMPEG_TIMEOUT);

    // Hostile corrupt container (PermanentError)
    const corruptErr = classifyFfmpegError(
      1,
      null,
      '[mov,mp4,m4a,3gp,3g2,mj2 @ 0x123] Invalid data found when processing input'
    );
    expect(corruptErr).toBeInstanceOf(PermanentError);
    expect((corruptErr as PermanentError).code).toBe(ErrorCodes.CORRUPT_CONTAINER);

    // General ffmpeg transcode error
    const genericErr = classifyFfmpegError(1, null, 'Unknown error during encode');
    expect(genericErr).toBeInstanceOf(TransientError);
    expect((genericErr as TransientError).code).toBe(ErrorCodes.FFMPEG_FAILED);
  });

  it('generates master playlist matching SDD §8.4 with correct BANDWIDTH, RESOLUTION, and CODECS', () => {
    const singleVariant = generateMasterPlaylist({
      ladder: [ladder720p],
      fps: 24,
    });

    expect(singleVariant).toContain('#EXTM3U');
    expect(singleVariant).toContain('#EXT-X-VERSION:6');
    expect(singleVariant).toContain('#EXT-X-INDEPENDENT-SEGMENTS');
    expect(singleVariant).toContain(
      '#EXT-X-STREAM-INF:BANDWIDTH=2996000,AVERAGE-BANDWIDTH=2928000,RESOLUTION=1280x720,FRAME-RATE=24.000,CODECS="avc1.64001f,mp4a.40.2"'
    );
    expect(singleVariant).toContain('720p/index.m3u8');

    // Multi-variant order check
    const multiVariant = generateMasterPlaylist({
      ladder: [ladder720p, ladder1080p],
      fps: 24,
    });
    const lines = multiVariant.split('\n');
    const firstStreamIdx = lines.findIndex((l) => l.includes('RESOLUTION=1920x1080'));
    const secondStreamIdx = lines.findIndex((l) => l.includes('RESOLUTION=1280x720'));
    expect(firstStreamIdx).toBeLessThan(secondStreamIdx); // 1080p comes before 720p
  });

  it('generates master playlist with measured AVERAGE-BANDWIDTH when measuredResults provided', () => {
    const ladder480p: LadderEntry = {
      name: '480p',
      width: 854,
      height: 480,
      videoKbps: 1400,
      maxrateKbps: 1498,
      bufsizeKbps: 2100,
      audioKbps: 96,
      profile: 'main',
      level: '3.1',
    };

    // 10-second duration: 5_000_000 bytes -> (5_000_000 * 8) / 10 = 4_000_000 bps
    const master = generateMasterPlaylist({
      ladder: [ladder1080p, ladder720p, ladder480p],
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
    // 480p without measured results falls back to theoretical bitrate (1400 + 96) * 1000 = 1496000
    expect(master).toContain(
      '#EXT-X-STREAM-INF:BANDWIDTH=1498000,AVERAGE-BANDWIDTH=1496000,RESOLUTION=854x480,FRAME-RATE=24.000,CODECS="avc1.4d401f,mp4a.40.2"'
    );

    // Verify ordering: 1080p -> 720p -> 480p
    const lines = master.split('\n');
    const idx1080 = lines.findIndex((l) => l.includes('1080p/index.m3u8'));
    const idx720 = lines.findIndex((l) => l.includes('720p/index.m3u8'));
    const idx480 = lines.findIndex((l) => l.includes('480p/index.m3u8'));
    expect(idx1080).toBeLessThan(idx720);
    expect(idx720).toBeLessThan(idx480);

    // Snapshot master playlist for s60 fixture (Ticket 12 testing plan)
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

  it('getAvcCodecString computes correct RFC 6381 codec strings for profile and level', () => {
    expect(getAvcCodecString('high', '4.1')).toBe('avc1.640029');
    expect(getAvcCodecString('high', '3.1')).toBe('avc1.64001f');
    expect(getAvcCodecString('main', '3.1')).toBe('avc1.4d401f');
  });
});
