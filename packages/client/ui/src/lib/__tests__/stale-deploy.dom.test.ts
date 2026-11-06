import { onStaleDeploy, reloadOnceForStaleDeploy } from '../stale-deploy';

const failure = (message: string) =>
  new TypeError(`Failed to fetch dynamically imported module: ${message}`);

describe('@vp/ui: reloadOnceForStaleDeploy', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('runs the recovery once per failure, and never again for the same one', () => {
    const recover = vi.fn();
    const stop = onStaleDeploy(recover);

    const results = [
      reloadOnceForStaleDeploy(failure('a.js')),
      reloadOnceForStaleDeploy(failure('a.js')),
      reloadOnceForStaleDeploy(failure('b.js')),
    ];

    expect(results).toEqual([true, false, true]);
    expect(recover).toHaveBeenCalledTimes(2);
    stop();
  });

  it('leaves an error that is not a module import failure to the caller', () => {
    const recover = vi.fn();
    const stop = onStaleDeploy(recover);

    expect(reloadOnceForStaleDeploy(new Error('boom'))).toBe(false);
    expect(recover).not.toHaveBeenCalled();
    stop();
  });

  it('does not reload when the session cannot remember it did, which would loop', () => {
    const recover = vi.fn();
    const stop = onStaleDeploy(recover);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(reloadOnceForStaleDeploy(failure('a.js'))).toBe(false);
    expect(recover).not.toHaveBeenCalled();
    stop();
  });
});
