import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractEvidenceFrame } from '../evidence-frame';

describe('@vp/fingerprint: evidence frame', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vp-evidence-'));
    await writeFile(
      join(dir, 'ffmpeg'),
      `#!/bin/sh\necho "$@" > "$(dirname "$0")/argv"\nprintf '\\377\\330jpeg\\377\\331'\n`
    );
    await chmod(join(dir, 'ffmpeg'), 0o755);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const extract = () =>
    extractEvidenceFrame({
      ffmpegPath: join(dir, 'ffmpeg'),
      sourcePath: 'a.mp4',
      timestampSeconds: 12,
      widthPixels: 320,
      timeoutMs: 5000,
      limits: { killGraceMs: 100, stderrTailLines: 10 },
    });

  it('returns the bytes ffmpeg writes for the one frame', async () => {
    const jpeg = await extract();

    expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect(jpeg).toHaveLength(8);
  });

  it('seeks first, keeps the aspect ratio and writes one JPEG to stdout', async () => {
    await extract();

    const args = (await readFile(join(dir, 'argv'), 'utf8')).trim().split(' ');
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(args).toContain('scale=320:-2');
    expect(args.slice(-3)).toEqual(['-c:v', 'mjpeg', 'pipe:1']);
  });
});
