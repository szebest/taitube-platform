import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { type CliHost, run } from '../cli';

function recordingHost(argv: string[]) {
  const log = captureLog();
  const host: CliHost = {
    argv,
    print: vi.fn(),
    log: createLogger({
      service: 'gen-video',
      level: 'info',
      format: 'pretty',
      destination: log.destination,
    }),
  };
  return { host, log };
}

describe('packages/gen-video: run', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints its usage for --help and generates nothing', async () => {
    const { host, log } = recordingHost(['--help']);

    await run(host);

    expect(host.print).toHaveBeenCalledTimes(1);
    expect(host.print).toHaveBeenCalledWith(expect.stringContaining('pnpm gen-video [options]'));
    expect(log.text()).toBe('');
  });

  it('rejects when the output directory cannot be written', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-gen-video-'));
    const blocker = path.join(dir, 'a-file');
    fs.writeFileSync(blocker, '');
    const { host } = recordingHost([
      '--output-dir',
      path.join(blocker, 'fixtures'),
      '--only',
      'zero-bytes',
    ]);

    const generating = run(host);

    await expect(generating).rejects.toMatchObject({ code: 'ENOTDIR' });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
