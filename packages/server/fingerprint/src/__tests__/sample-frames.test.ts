import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sampleFrames } from '../sample-frames';

/** Stands in for ffmpeg: prints a flat 200 frame, a flat 10 frame, a ramp frame and the start of a fourth. */
const FAKE_FFMPEG = `#!/bin/sh
case "$(cat "$(dirname "$0")/mode")" in
  frames)
    i=0; while [ $i -lt 72 ]; do printf '\\310'; i=$((i+1)); done
    i=0; while [ $i -lt 72 ]; do printf '\\012'; i=$((i+1)); done
    i=0; while [ $i -lt 8 ]; do printf '\\310\\226\\144\\062\\012\\012\\012\\012\\012'; i=$((i+1)); done
    printf '\\001\\002\\003'
    ;;
  fail) echo "Invalid data found when processing input" >&2; exit 1 ;;
esac
`;

describe('@vp/fingerprint: sampleFrames', () => {
  let dir: string;
  const run = () =>
    sampleFrames({
      ffmpegPath: join(dir, 'ffmpeg'),
      sourcePath: join(dir, 'in.mp4'),
      intervalSeconds: 2,
      timeoutMs: 5000,
      limits: { killGraceMs: 100, stderrTailLines: 10 },
    });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vp-frames-'));
    await writeFile(join(dir, 'ffmpeg'), FAKE_FFMPEG);
    await chmod(join(dir, 'ffmpeg'), 0o755);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('hashes each whole frame in order and drops the cut-off tail', async () => {
    await writeFile(join(dir, 'mode'), 'frames');

    const frames = await run();

    expect(frames.map((frame) => frame.hash)).toEqual([0n, 0n, 0xf0f0_f0f0_f0f0_f0f0n]);
    expect(frames.map((frame) => Math.round(frame.luma))).toEqual([200, 10, 61]);
  });

  it('throws the classified failure of a source ffmpeg cannot read', async () => {
    await writeFile(join(dir, 'mode'), 'fail');

    await expect(run()).rejects.toThrow(/decode input container/);
  });
});
