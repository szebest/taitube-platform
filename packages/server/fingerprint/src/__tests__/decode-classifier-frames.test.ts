import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sampleClassifierFrames } from '../decode-classifier-frames';

const SIZE = 4;

/** Stands in for ffmpeg: logs the `-ss` it was given and prints a flat frame of that many bytes, none past 30 s. */
const FAKE_FFMPEG = `#!/bin/sh
dir="$(dirname "$0")"
ARGS="$*"
while [ $# -gt 0 ]; do
  if [ "$1" = "-ss" ]; then at="$2"; fi
  shift
done
echo "$at" >> "$dir/calls"
echo "$ARGS" > "$dir/argv"
if [ "\${at%.*}" -gt 30 ]; then exit 0; fi
i=0; while [ $i -lt 48 ]; do printf '\\144'; i=$((i+1)); done
`;

describe('@vp/fingerprint: classifier frames', () => {
  let dir: string;
  const options = (timestampsSeconds: number[], concurrency = 2) => ({
    ffmpegPath: join(dir, 'ffmpeg'),
    sourcePath: join(dir, 'in.mp4'),
    timestampsSeconds,
    size: SIZE,
    concurrency,
    timeoutMs: 5000,
    limits: { killGraceMs: 100, stderrTailLines: 10 },
  });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vp-classifier-frames-'));
    await writeFile(join(dir, 'ffmpeg'), FAKE_FFMPEG);
    await chmod(join(dir, 'ffmpeg'), 0o755);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('asks for one square RGB frame at each moment and returns them in order', async () => {
    const frames = await sampleClassifierFrames(options([0, 12.5, 20]));

    expect(frames.map((frame) => frame.timestampSeconds)).toEqual([0, 12.5, 20]);
    expect(frames[0]?.frame).toMatchObject({ width: SIZE, height: SIZE });
    expect(frames[0]?.frame.data).toHaveLength(SIZE * SIZE * 3);
    expect(new Set(frames[1]?.frame.data)).toEqual(new Set([100]));
  });

  it('leaves out a moment the source has no frame for', async () => {
    const frames = await sampleClassifierFrames(options([10, 31, 20]));

    expect(frames.map((frame) => frame.timestampSeconds)).toEqual([10, 20]);
  });

  it.each([{ concurrency: 1 }, { concurrency: 3 }, { concurrency: 8 }])(
    'decodes every moment once whatever the concurrency, here $concurrency',
    async ({ concurrency }) => {
      await sampleClassifierFrames(options([0, 5, 10, 15, 20], concurrency));

      const calls = (await readFile(join(dir, 'calls'), 'utf8')).trim().split('\n');
      expect([...calls].sort((a, b) => Number(a) - Number(b))).toEqual([
        '0',
        '5',
        '10',
        '15',
        '20',
      ]);
    }
  );

  it('throws the classified failure of a source ffmpeg cannot read', async () => {
    await writeFile(
      join(dir, 'ffmpeg'),
      '#!/bin/sh\necho "Invalid data found when processing input" >&2\nexit 1\n'
    );

    await expect(sampleClassifierFrames(options([0]))).rejects.toThrow(/decode input container/);
  });

  it('seeks before the input, takes a single frame and scales it to the classifier size', async () => {
    await sampleClassifierFrames({ ...options([7]), size: 384 });

    const args = (await readFile(join(dir, 'argv'), 'utf8')).trim().split(' ');
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(args).toContain('scale=384:384:flags=bilinear');
    expect(args.slice(args.indexOf('-frames:v'), args.indexOf('-frames:v') + 2)).toEqual([
      '-frames:v',
      '1',
    ]);
  });
});
