import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { main } from '../main';

describe('packages/gen-video: main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints its usage for --help and generates nothing', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main(['--help']);

    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain('pnpm gen-video [options]');
  });

  it('prints why the output directory cannot be written and exits 1', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-gen-video-'));
    const blocker = path.join(dir, 'a-file');
    fs.writeFileSync(blocker, '');
    const outputDir = path.join(blocker, 'fixtures');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited');
    }) as () => never);

    await expect(main(['--output-dir', outputDir, '--only', 'zero-bytes'])).rejects.toThrow(
      'exited'
    );

    expect(String(error.mock.calls[0]?.[0])).toContain(
      `[gen-video] Could not write fixtures into ${outputDir}: `
    );
    expect(exit).toHaveBeenCalledWith(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
