import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CANONICAL_LADDER } from '@vp/job-contracts';
import { runFfmpegTranscode } from '../transcode';
import { ENCODER } from './encoder-settings';

const S2 = path.resolve(__dirname, '../../../../../tests/fixtures/s2.mp4');

describe('@vp/ffmpeg: runFfmpegTranscode', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-transcode-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('writes the playlist and its segments, and reports its progress in percent', async () => {
    const percents: number[] = [];

    const result = await runFfmpegTranscode({
      ...ENCODER,
      gopSeconds: 0.5,
      hlsSegmentSeconds: 0.5,
      sourcePath: S2,
      outputDir,
      rendition: CANONICAL_LADDER[2],
      fps: 24,
      durationMs: 2000,
      threads: 0,
      preset: 'ultrafast',
      onProgress: ({ percent }) => percents.push(percent),
    });

    const segments = fs.readdirSync(outputDir).filter((file) => file.endsWith('.ts'));
    expect(fs.readFileSync(result.playlistPath, 'utf-8')).toContain('#EXTM3U');
    expect(segments.length).toBeGreaterThanOrEqual(3);
    expect(percents.length).toBeGreaterThan(0);
    expect(Math.max(...percents)).toBeLessThanOrEqual(100);
  });
});
