import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CANONICAL_LADDER } from '@vp/job-contracts';
import type { Fmp4Fragment } from '../fmp4-fragments';
import { runFfmpegLive } from '../live';

const [, RUNG_720P] = CANONICAL_LADDER;
const BOX = (type: string) => `\\000\\000\\000\\010${type}`;
const STREAM = ['ftyp', 'moov', 'moof', 'mdat'].map(BOX).join('');

describe('@vp/ffmpeg: runFfmpegLive', () => {
  let dir: string;
  let ffmpegPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vp-live-'));
    ffmpegPath = join(dir, 'ffmpeg');
    writeFileSync(ffmpegPath, `#!/bin/sh\nprintf '${STREAM}'\n`);
    chmodSync(ffmpegPath, 0o755);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function run(onFragment: (fragment: Fmp4Fragment) => void) {
    return runFfmpegLive({
      ffmpegPath,
      limits: { killGraceMs: 200, stderrTailLines: 20 },
      timeoutMs: 5_000,
      inputUrl: 'rtsp://ingest/live/key',
      rendition: RUNG_720P,
      fps: 30,
      segmentMs: 2000,
      partMs: 500,
      readTimeoutMs: 10_000,
      preset: 'veryfast',
      threads: 2,
      onFragment,
    });
  }

  it('hands each fragment of the stream on as it is cut', async () => {
    const fragments: Fmp4Fragment['type'][] = [];

    await run((fragment) => fragments.push(fragment.type));

    expect(fragments).toEqual(['init', 'media']);
  });

  it('rejects with the error the packager raised, not as an aborted run', async () => {
    const refused = new Error('storage refused the part');

    await expect(
      run(() => {
        throw refused;
      })
    ).rejects.toBe(refused);
  });
});
