import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
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
  ])('prints why the $config --config file failed and exits 1', async ({ write, cause }) => {
    const configFile = path.join(dir, 'stages.json');
    if (write !== undefined) fs.writeFileSync(configFile, write);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited');
    }) as () => never);

    await expect(main(['--config', configFile])).rejects.toThrow('exited');

    const printed = String(error.mock.calls[0]?.[0]);
    expect(printed.startsWith(`Failed to load config file ${configFile}: `)).toBe(true);
    expect(printed).toContain(cause);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
