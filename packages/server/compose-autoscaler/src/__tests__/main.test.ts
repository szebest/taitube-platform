import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { main } from '../main';

describe('packages/compose-autoscaler: main', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-autoscaler-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it.each([
    { config: 'missing', write: undefined, cause: 'ENOENT' },
    { config: 'malformed', write: '{ not json', cause: 'SyntaxError' },
  ])('logs why the $config --config file failed and exits 1', async ({ write, cause }) => {
    const configFile = path.join(dir, 'stages.json');
    if (write !== undefined) fs.writeFileSync(configFile, write);
    const log = captureLog();
    const logger = createLogger({
      service: 'compose-autoscaler',
      level: 'info',
      format: 'pretty',
      destination: log.destination,
    });
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited');
    }) as () => never);

    await expect(main(['--config', configFile], logger)).rejects.toThrow('exited');

    expect(log.text()).toContain('error could not read the stage configs');
    expect(log.text()).toContain(`Failed to load config file ${configFile}: `);
    expect(log.text()).toContain(cause);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
