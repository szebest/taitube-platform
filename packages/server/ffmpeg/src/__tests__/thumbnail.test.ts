import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runFfprobe } from '../probe';
import { runFfmpegThumbnail } from '../thumbnail';
import { ENCODER, LIMITS, PROBE_LIMITS, SPRITE } from './encoder-settings';

const FIXTURES = path.resolve(__dirname, '../../../../../tests/fixtures');

function ffmpegOutput(args: string[]): Buffer {
  return execFileSync(ENCODER.ffmpegPath, ['-hide_banner', '-loglevel', 'error', ...args]);
}

function dimensions(imagePath: string): string {
  return execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=s=x:p=0',
      imagePath,
    ],
    { encoding: 'utf-8' }
  ).trim();
}

function tileBrightness(spritePath: string, tile: number): number {
  const { columns, tileWidth: w, tileHeight: h } = SPRITE;
  const x = (tile % columns) * w;
  const y = Math.floor(tile / columns) * h;
  const pixels = ffmpegOutput([
    '-i',
    spritePath,
    '-vf',
    `crop=${w}:${h}:${x}:${y},format=gray`,
    '-f',
    'rawvideo',
    '-',
  ]);
  return pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
}

describe('@vp/ffmpeg: runFfmpegThumbnail', () => {
  let tmpRoot: string;
  let audioLongerThanVideo: string;

  beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-thumb-test-'));
    audioLongerThanVideo = path.join(tmpRoot, 'video-10s-audio-11s.mp4');
    ffmpegOutput([
      '-f',
      'lavfi',
      '-t',
      '10',
      '-i',
      'testsrc2=size=640x360:rate=24',
      '-f',
      'lavfi',
      '-t',
      '11',
      '-i',
      'sine=frequency=440:sample_rate=48000',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      audioLongerThanVideo,
    ]);
  });

  afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it.each([
    { source: 's15.mp4', sourcePath: () => path.join(FIXTURES, 's15.mp4'), frameCount: 3 },
    { source: 's2.mp4', sourcePath: () => path.join(FIXTURES, 's2.mp4'), frameCount: 1 },
    {
      source: '10 s of video under 11 s of audio',
      sourcePath: () => audioLongerThanVideo,
      frameCount: 2,
    },
  ])(
    'gives $source a poster and $frameCount VTT cues, each over a filled tile',
    async ({ sourcePath, frameCount }) => {
      const outputDir = await fs.mkdtemp(path.join(tmpRoot, 'out-'));
      const metadata = await runFfprobe(sourcePath(), PROBE_LIMITS);

      const result = await runFfmpegThumbnail({
        ffmpegPath: ENCODER.ffmpegPath,
        sourcePath: sourcePath(),
        outputDir,
        durationMs: metadata.videoDurationMs,
        layout: SPRITE,
        timeoutMs: 60_000,
        limits: LIMITS,
      });

      expect(result).toMatchObject({ frameCount, rows: 1, columns: 10 });

      const vttContent = await fs.readFile(result.vttPath, 'utf-8');
      const timings = vttContent.split('\n').filter((line) => line.includes(' --> '));
      expect(timings).toHaveLength(frameCount);

      const tiles = Array.from({ length: frameCount }, (_, tile) =>
        tileBrightness(result.spritePath, tile)
      );
      expect(tiles.every((brightness) => brightness > 32)).toBe(true);

      expect(dimensions(result.posterPath)).toBe('1280x720');
      expect(dimensions(result.spritePath)).toBe('1600x90');
    }
  );
});
