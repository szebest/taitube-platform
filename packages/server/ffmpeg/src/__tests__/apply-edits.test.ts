import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CANONICAL_LADDER } from '@vp/job-contracts';
import { runFfmpegApplyEdits } from '../apply-edits';
import { ENCODER } from './encoder-settings';

const S2 = path.resolve(__dirname, '../../../../../tests/fixtures/s2.mp4');

function playlistSeconds(playlist: string): number {
  return [...playlist.matchAll(/#EXTINF:([\d.]+)/g)].reduce(
    (sum, [, length]) => sum + Number(length),
    0
  );
}

/** PSNR of the top-left quarter of one frame of `rendered` against the same frame of the source. */
function quarterPsnr(rendered: string, atSeconds: number): number {
  const quarter = 'scale=854:480,crop=iw/2:ih/2:0:0';
  const run = spawnSync(ENCODER.ffmpegPath, [
    '-hide_banner',
    ...['-ss', String(atSeconds), '-i', rendered],
    ...['-ss', String(atSeconds), '-i', S2],
    ...[
      '-frames:v',
      '1',
      '-lavfi',
      `[0]${quarter}[a];[1]${quarter}[b];[a][b]psnr`,
      '-f',
      'null',
      '-',
    ],
  ]);
  const average = /average:([\d.]+|inf)/.exec(run.stderr.toString())?.[1] ?? '0';
  return average === 'inf' ? Number.POSITIVE_INFINITY : Number(average);
}

describe('@vp/ffmpeg: runFfmpegApplyEdits', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-apply-edits-'));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('renders the trimmed, blurred rendition in one pass', async () => {
    const result = await runFfmpegApplyEdits({
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
      hasAudio: true,
      edits: {
        trim: { startMs: 500, endMs: 1_500 },
        blurs: [
          { startMs: 0, endMs: 1_000, shape: 'rect', x: 0.1, y: 0.1, w: 0.3, h: 0.3, strength: 10 },
          {
            startMs: 600,
            endMs: 2_000,
            shape: 'ellipse',
            x: 0.5,
            y: 0.5,
            w: 0.4,
            h: 0.4,
            strength: 20,
          },
        ],
      },
    });

    const playlist = fs.readFileSync(result.playlistPath, 'utf-8');
    expect(playlist).toContain('#EXT-X-ENDLIST');
    expect(playlistSeconds(playlist)).toBeGreaterThan(0.8);
    expect(playlistSeconds(playlist)).toBeLessThan(1.3);
  });

  it('blurs the region only on the frames inside its range', async () => {
    const result = await runFfmpegApplyEdits({
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
      hasAudio: true,
      edits: {
        trim: null,
        blurs: [
          { startMs: 1_000, endMs: 1_500, shape: 'rect', x: 0, y: 0, w: 0.5, h: 0.5, strength: 20 },
        ],
      },
    });

    const outside = quarterPsnr(result.playlistPath, 0.5);
    const inside = quarterPsnr(result.playlistPath, 1.25);
    expect(inside).toBeLessThan(outside - 5);
  });
});
