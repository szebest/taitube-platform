import { shouldPrefetch } from '../should-prefetch';

describe('apps/client/web: shouldPrefetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['no connection API', undefined, true],
    ['an unreadable connection', 'fast', true],
    ['a 4g link', { effectiveType: '4g', saveData: false }, true],
    ['save-data on a 4g link', { effectiveType: '4g', saveData: true }, false],
    ['a 2g link', { effectiveType: '2g' }, false],
    ['a slow-2g link', { effectiveType: 'slow-2g' }, false],
  ])('with %s: %s', (_label, connection, expected) => {
    vi.stubGlobal('navigator', { connection });

    expect(shouldPrefetch()).toBe(expected);
  });

  it('prefetches when there is no navigator at all', () => {
    vi.stubGlobal('navigator', undefined);

    expect(shouldPrefetch()).toBe(true);
  });
});
