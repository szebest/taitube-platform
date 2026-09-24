import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { main } from '../main';

function recordingLogger() {
  const log = captureLog();
  const logger = createLogger({
    service: 'gen-video',
    level: 'info',
    format: 'pretty',
    destination: log.destination,
  });
  return { log, logger };
}

describe('packages/gen-video: main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints its usage for --help and generates nothing', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { log, logger } = recordingLogger();

    await main(['--help'], logger);

    expect(write).toHaveBeenCalledTimes(1);
    expect(String(write.mock.calls[0]?.[0])).toContain('pnpm gen-video [options]');
    expect(log.text()).toBe('');
  });

  it('logs why the output directory cannot be written and exits 1', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-gen-video-'));
    const blocker = path.join(dir, 'a-file');
    fs.writeFileSync(blocker, '');
    const outputDir = path.join(blocker, 'fixtures');
    const { log, logger } = recordingLogger();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited');
    }) as () => never);

    await expect(main(['--output-dir', outputDir, '--only', 'zero-bytes'], logger)).rejects.toThrow(
      'exited'
    );

    expect(log.text()).toContain(`error could not write fixtures outputDir=${outputDir}`);
    expect(log.text()).toContain('ENOTDIR');
    expect(exit).toHaveBeenCalledWith(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
