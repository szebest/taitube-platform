import { singleFlightRefresh } from '../single-flight-refresh';

function slowRefresh() {
  const releases: (() => void)[] = [];
  const refresh = vi.fn(
    (refused: string) =>
      new Promise<string | undefined>((resolve) => {
        releases.push(() => resolve(`fresh-${refused}`));
      })
  );
  const releaseAll = () => {
    for (const release of releases) release();
  };
  return { refresh, releaseAll };
}

describe('@vp/queries: single-flight refresh', () => {
  it('shares one refresh between parallel calls with the same refused token', async () => {
    const { refresh, releaseAll } = slowRefresh();
    const single = singleFlightRefresh(refresh);

    const answers = Promise.all([single('stale'), single('stale')]);
    releaseAll();

    expect(await answers).toEqual(['fresh-stale', 'fresh-stale']);
    expect(refresh).toHaveBeenCalledExactlyOnceWith('stale');
  });

  it('refreshes each refused token on its own', async () => {
    const { refresh, releaseAll } = slowRefresh();
    const single = singleFlightRefresh(refresh);

    const answers = Promise.all([single('one'), single('two')]);
    releaseAll();

    expect(await answers).toEqual(['fresh-one', 'fresh-two']);
  });

  it.each([
    { settled: 'resolves', refresh: async () => 'fresh' },
    {
      settled: 'rejects',
      refresh: async () => {
        throw new Error('down');
      },
    },
  ])('refreshes again once a refresh that $settled is over', async ({ refresh }) => {
    const refreshing = vi.fn(refresh);
    const single = singleFlightRefresh(refreshing);

    await single('stale').catch(() => undefined);
    await single('stale').catch(() => undefined);

    expect(refreshing).toHaveBeenCalledTimes(2);
  });
});
