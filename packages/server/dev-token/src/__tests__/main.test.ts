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
});
