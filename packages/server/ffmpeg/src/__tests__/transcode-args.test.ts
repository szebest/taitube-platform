import type { LadderEntry } from '@vp/job-contracts';
import { buildTranscodeArgs, computeFfmpegThreads } from '../transcode-args';
import { ENCODER } from './encoder-settings';

describe('@vp/ffmpeg: transcode arguments', () => {
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

  it('takes the GOP and segment length from the settings it is handed', () => {
    const args = buildTranscodeArgs({
      ...ENCODER,
      gopSeconds: 4,
      hlsSegmentSeconds: 8,
      sourcePath: '/tmp/source.mp4',
      outputDir: '/tmp/out-720p',
      rendition: ladder720p,
      fps: 30,
      threads: 2,
      preset: 'veryfast',
    });
    const argAfter = (flag: string) => args[args.indexOf(flag) + 1];

    expect([argAfter('-g'), argAfter('-keyint_min'), argAfter('-hls_time')]).toEqual([
      '120',
      '120',
      '8',
    ]);
    expect(args).toContain('expr:gte(t,n_forced*4)');
  });

  it('buildTranscodeArgs derives GOP = round(2 * fps) and enforces SDD §8.2 flags', () => {
    const args24 = buildTranscodeArgs({
      ...ENCODER,
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

    const gIndex24 = args24.indexOf('-g');
    expect(gIndex24).toBeGreaterThan(-1);
    expect(args24[gIndex24 + 1]).toBe('48');
    const minGIndex24 = args24.indexOf('-keyint_min');
    expect(args24[minGIndex24 + 1]).toBe('48');
    expect(args24).toContain('expr:gte(t,n_forced*2)');

    expect(args24).toContain('-hls_time');
    const timeIndex = args24.indexOf('-hls_time');
    expect(args24[timeIndex + 1]).toBe('6');
    expect(args24).toContain('independent_segments+temp_file');
    expect(args24).toContain('mpegts');

    const args30 = buildTranscodeArgs({
      ...ENCODER,
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

  describe('thread back-off (SDD §9.6 rule 6)', () => {
    it.each([
      { base: 2, attempt: 1, expected: 2 },
      { base: 2, attempt: 2, expected: 1 },
      { base: 2, attempt: 3, expected: 1 },
      { base: 4, attempt: 1, expected: 4 },
      { base: 4, attempt: 2, expected: 3 },
      { base: 4, attempt: 3, expected: 2 },
      { base: 4, attempt: 4, expected: 1 },
      { base: 4, attempt: 5, expected: 1 },
    ])(
      'computes $expected threads from base $base on attempt $attempt',
      ({ base, attempt, expected }) => {
        expect(computeFfmpegThreads(base, attempt)).toBe(expected);
      }
    );

    it.each([
      { attempt: 1, expected: '4' },
      { attempt: 2, expected: '3' },
      { attempt: 4, expected: '1' },
    ])('passes $expected threads to ffmpeg on attempt $attempt', ({ attempt, expected }) => {
      const args = buildTranscodeArgs({
        ...ENCODER,
        sourcePath: 'dummy.mp4',
        outputDir: 'out',
        rendition: ladder1080p,
        fps: 24,
        threads: 4,
        preset: 'veryfast',
        attempt,
      });

      expect(args[args.indexOf('-threads') + 1]).toBe(expected);
    });

    it('enforces -fps_mode cfr in buildTranscodeArgs for VFR handling', () => {
      const args = buildTranscodeArgs({
        ...ENCODER,
        sourcePath: 'dummy.mp4',
        outputDir: 'out',
        rendition: ladder1080p,
        fps: 24,
        threads: 2,
        preset: 'veryfast',
      });
      const fpsModeIdx = args.indexOf('-fps_mode');
      expect(fpsModeIdx).toBeGreaterThanOrEqual(0);
      expect(args[fpsModeIdx + 1]).toBe('cfr');
    });
  });
});
