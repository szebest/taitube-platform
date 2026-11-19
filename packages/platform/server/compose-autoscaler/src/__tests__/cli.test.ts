import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createLogger } from '@kit/logger';
import { captureLog } from '@kit/testing/log-capture';
import { type CliHost, run } from '../cli';
import type { AutoscalerConfig } from '../config';

const CONFIG: AutoscalerConfig = {
  metricsPath: '/stats',
  stages: { 'stage-a': { minReplicas: 0, maxReplicas: 2, threshold: 1, cooldownSeconds: 30 } },
};

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

    run(CONFIG, cli);

    expect(cli.print).toHaveBeenCalledWith(
      expect.stringContaining('pnpm compose-autoscaler [options]')
    );
    expect(cli.print).toHaveBeenCalledWith(expect.stringContaining('localhost:9464/stats'));
    expect(cli.onSignal).not.toHaveBeenCalled();
  });

  it.each([
    { config: 'missing', write: undefined, error: /ENOENT/ },
    { config: 'malformed', write: '{ not json', error: SyntaxError },
    { config: 'mistyped', write: '{ "stage-a": { "minReplicas": "1" } }', error: TypeError },
    { config: 'non-object', write: 'null', error: TypeError },
  ])('refuses to start with a $config --config file', ({ write, error }) => {
    const configFile = path.join(dir, 'stages.json');
    if (write !== undefined) fs.writeFileSync(configFile, write);
    const cli = host(['--config', configFile]);

    expect(() => run(CONFIG, cli)).toThrow(error);
    expect(cli.onSignal).not.toHaveBeenCalled();
  });
});
