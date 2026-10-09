import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runTmpSweep } from '../tmp-sweep';
import { HOUR_MS, hoursAgo } from './housekeeping-harness';

const exists = (target: string) =>
  fs
    .access(target)
    .then(() => true)
    .catch(() => false);

describe('housekeeping: tmp-sweep', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vp-sweep-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('removes scratch directories older than the threshold and keeps recent ones', async () => {
    const oldDir = path.join(tmpDir, 'old-job');
    const newDir = path.join(tmpDir, 'new-job');
    for (const dir of [oldDir, newDir]) {
      await fs.mkdir(dir);
      await fs.writeFile(path.join(dir, 'segment.ts'), 'segment');
    }
    await fs.utimes(oldDir, hoursAgo(3), hoursAgo(3));

    expect(await runTmpSweep({ tmpDir, thresholdMs: 2 * HOUR_MS })).toEqual({ sweptCount: 1 });

    expect(await exists(oldDir)).toBe(false);
    expect(await exists(newDir)).toBe(true);
  });
});
