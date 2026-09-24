import { createLogger } from '@vp/logger';
import { captureLog } from '@vp/testing/log-capture';
import { mintToken } from '../jwt';
import { DEV_KEY_ID } from '../keys';
import { type Cli, main } from '../main';

function recordingCli() {
  const printed: string[] = [];
  const log = captureLog();
  const cli: Cli = {
    print: (text) => printed.push(text),
    log: createLogger({
      service: 'dev-token',
      level: 'info',
      format: 'pretty',
      destination: log.destination,
    }),
  };
  return { cli, printed, log };
}

describe('packages/dev-token: main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints the dev JWKS for `jwks`', async () => {
    const { cli, printed } = recordingCli();

    await main(['jwks'], cli);

    expect(JSON.parse(printed[0] ?? '').keys[0].kid).toBe(DEV_KEY_ID);
  });

  it('prints only the token for `mint --raw`', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await main(['mint', '--role', 'admin', '--raw'], recordingCli().cli);

    expect(String(write.mock.calls[0]?.[0]).split('.')).toHaveLength(3);
  });

  it('prints the payload of a valid token for `verify`', async () => {
    const { cli, printed } = recordingCli();

    await main(['verify', mintToken({ sub: 'usr-1', role: 'admin', ttl: '1h' })], cli);

    expect(JSON.parse(printed[0] ?? '')).toMatchObject({ sub: 'usr-1', role: 'admin' });
  });

  it('logs the reason and exits non-zero on a token that does not verify', async () => {
    const { cli, log } = recordingCli();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited');
    }) as () => never);

    await expect(main(['verify', 'not.a.token'], cli)).rejects.toThrow('exited');

    expect(log.text()).toContain('error token is invalid');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
