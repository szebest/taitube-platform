import { mintToken } from '../jwt';
import { DEV_KEY_ID } from '../keys';
import { main } from '../main';

describe('packages/dev-token: main', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints the dev JWKS for `jwks`', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main(['jwks']);

    expect(JSON.parse(String(log.mock.calls[0]?.[0])).keys[0].kid).toBe(DEV_KEY_ID);
  });

  it('prints only the token for `mint --raw`', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await main(['mint', '--role', 'admin', '--raw']);

    expect(String(write.mock.calls[0]?.[0]).split('.')).toHaveLength(3);
  });

  it('prints the payload of a valid token for `verify`', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await main(['verify', mintToken({ sub: 'usr-1', role: 'admin', ttl: '1h' })]);

    expect(log).toHaveBeenCalledWith('✓ Token valid:');
  });

  it('exits non-zero on a token that does not verify', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exited');
    }) as () => never);

    await expect(main(['verify', 'not.a.token'])).rejects.toThrow('exited');

    expect(error.mock.calls[0]?.[0]).toBe('✗ Token invalid:');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
