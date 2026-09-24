import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createScratchDir, removeScratchDir } from '../scratch-dir';

describe('apps/worker: scratch directories', () => {
  let root: string;

  beforeEach(async () => {
    root = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'vp-scratch-')), 'missing-root');
  });

  afterEach(async () => {
    await fs.rm(path.dirname(root), { recursive: true, force: true });
  });

  it('creates a prefixed directory under a root that does not exist yet', async () => {
    const dir = await createScratchDir(root, 'vp-probe-');

    expect(path.basename(dir)).toMatch(/^vp-probe-/);
    expect((await fs.stat(dir)).isDirectory()).toBe(true);
  });

  it.each([
    { state: 'a directory with files in it', seed: true },
    { state: 'a directory that is already gone', seed: false },
  ])('removes $state without failing', async ({ seed }) => {
    const dir = await createScratchDir(root, 'vp-thumb-');
    if (seed) await fs.writeFile(path.join(dir, 'poster.jpg'), 'bytes');
    else await fs.rm(dir, { recursive: true });

    await removeScratchDir(dir);

    await expect(fs.stat(dir)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
