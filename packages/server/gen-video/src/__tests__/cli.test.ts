import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { run } from '../cli';

describe('packages/gen-video: run', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints its usage for --help and generates nothing', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await run({ argv: ['--help'] });

    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain('pnpm gen-video [options]');
  });

  it('rejects when the output directory cannot be written', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-gen-video-'));
    const blocker = path.join(dir, 'a-file');
    fs.writeFileSync(blocker, '');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const generating = run({
      argv: ['--output-dir', path.join(blocker, 'fixtures'), '--only', 'zero-bytes'],
    });

    await expect(generating).rejects.toMatchObject({ code: 'ENOTDIR' });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
