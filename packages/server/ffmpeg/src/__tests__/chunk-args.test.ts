import type { LadderEntry } from '@vp/job-contracts';
import { buildChunkArgs, buildConcatArgs } from '../chunk-args';

const rendition: LadderEntry = {
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

const argAfter = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('@vp/ffmpeg: chunk arguments', () => {
  const chunk = () =>
    buildChunkArgs({
      sourcePath: 'https://storage.test/source.mp4?sig=x',
      outputPath: '/tmp/chunk_00003.mp4',
      rendition,
      fps: 24,
      gopSeconds: 2,
      threads: 2,
      preset: 'veryfast',
      startSeconds: 90,
      durationSeconds: 30,
    });

  it('seeks to the chunk before the input and drops the audio', () => {
    const args = chunk();

    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect([argAfter(args, '-ss'), argAfter(args, '-t')]).toEqual(['90', '30']);
    expect(args).toContain('-an');
    expect(args.at(-1)).toBe('/tmp/chunk_00003.mp4');
  });

  it('encodes on the same keyframe grid as the single job', () => {
    const args = chunk();

    expect([argAfter(args, '-g'), argAfter(args, '-b:v')]).toEqual(['48', '2800k']);
    expect(args).toContain('expr:gte(t,n_forced*2)');
  });
});

describe('@vp/ffmpeg: concat arguments', () => {
  const args = buildConcatArgs({
    listPath: '/tmp/list.txt',
    audioSourcePath: '/tmp/source.mp4',
    outputDir: '/tmp/hls',
    rendition,
    hlsSegmentSeconds: 6,
    threads: 2,
  });

  it('copies the joined video and encodes the audio once from the source', () => {
    expect(argAfter(args, '-c:v')).toBe('copy');
    expect(argAfter(args, '-b:a')).toBe('128k');
    expect(args.filter((arg) => arg === '-i')).toHaveLength(2);
    expect(args).toContain('1:a:0?');
  });

  it('writes the HLS rendition into the output directory', () => {
    expect(argAfter(args, '-hls_time')).toBe('6');
    expect(args.at(-1)).toBe('/tmp/hls/index.m3u8');
  });
});
