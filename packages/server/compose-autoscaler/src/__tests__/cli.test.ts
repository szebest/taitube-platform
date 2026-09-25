import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { type CliHost, run } from '../cli';

function host(argv: string[]): CliHost {
  return {
    argv,
    env: {},
    executor: vi.fn(async () => ({ type: 'done' as const, value: undefined })),
    fetcher: vi.fn(async () => ({ type: 'done' as const, value: '' })),
    onSignal: vi.fn(),
    exit: vi.fn(),
    print: vi.fn(),
    log: createLogger({
      service: 'compose-autoscaler',
      level: 'info',
      format: 'pretty',
      destination: captureLog().destination,
    }),
  };
}

describe('packages/compose-autoscaler: run', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-autoscaler-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it.each(['--help', '-h'])('prints its usage for %s and starts nothing', (flag) => {
    const cli = host([flag]);

    run(cli);

    expect(cli.print).toHaveBeenCalledWith(
      expect.stringContaining('pnpm compose-autoscaler [options]')
    );
    expect(cli.onSignal).not.toHaveBeenCalled();
  });

  it.each([
    { config: 'missing', write: undefined, error: /ENOENT/ },
    { config: 'malformed', write: '{ not json', error: SyntaxError },
  ])('refuses to start with a $config --config file', ({ write, error }) => {
    const configFile = path.join(dir, 'stages.json');
    if (write !== undefined) fs.writeFileSync(configFile, write);
    const cli = host(['--config', configFile]);

    expect(() => run(cli)).toThrow(error);
    expect(cli.onSignal).not.toHaveBeenCalled();
  });
});
