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
});
