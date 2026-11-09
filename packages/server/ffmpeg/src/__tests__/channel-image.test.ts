import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runFfmpegChannelImage } from '../channel-image';
import { planChannelImageVariants } from '../channel-image-variants';
import { LIMITS } from './encoder-settings';

describe('@vp/ffmpeg: channel image with the real ffmpeg', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-channel-image-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes one WebP per planned avatar variant at its size', async () => {
    const source = path.join(dir, 'source.png');
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=s=640x480',
      '-frames:v',
      '1',
      source,
    ]);
    const variants = planChannelImageVariants({
      kind: 'avatar',
      crop: { x: 20, y: 10, width: 400, height: 400 },
    });

    const files = await runFfmpegChannelImage({
      ffmpegPath: 'ffmpeg',
      sourcePath: source,
      outputDir: dir,
      variants,
      timeoutMs: 30_000,
      limits: LIMITS,
    });

    expect(files.map((file) => file.name)).toEqual(['48', '72', '128', '256']);
    for (const file of files) {
      const size = execFileSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'stream=codec_name,width,height',
          '-of',
          'csv=p=0',
          file.path,
        ],
        { encoding: 'utf-8' }
      ).trim();
      expect(size).toBe(`webp,${file.name},${file.name}`);
    }
  });
});
