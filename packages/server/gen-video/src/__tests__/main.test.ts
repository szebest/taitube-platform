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
});
