import { act, render, screen } from '@testing-library/react';
import { lazyComponent } from '../lazy-component';
import { setStaleDeployRecovery } from '../stale-deploy';

const Greeting = ({ name }: { name: string }) => <p>{`Hello ${name}`}</p>;
const importFailure = () => new TypeError('Failed to fetch dynamically imported module: /a.js');

afterEach(() => {
  sessionStorage.clear();
  setStaleDeployRecovery(() => undefined);
});

describe('@vp/ui: lazyComponent', () => {
  it('imports the module once however it is asked, and renders it with its props', async () => {
    const load = vi.fn(async () => ({ default: Greeting }));
    const Lazy = lazyComponent(load, { name: 'Greeting' });

    const first = render(<Lazy name="Ana" />);
    await Lazy.preload();
    render(<Lazy name="Bo" />);

    expect(await screen.findByText('Hello Ana')).toBeInTheDocument();
    expect(screen.getByText('Hello Bo')).toBeInTheDocument();
    expect(load).toHaveBeenCalledOnce();
    first.unmount();
  });

  it('renders synchronously, with no fallback, once the module has loaded', async () => {
    const Lazy = lazyComponent(async () => ({ default: Greeting }), {
      name: 'Greeting',
      fallback: <p>Loading</p>,
    });
    await Lazy.preload();

    render(<Lazy name="Ana" />);

    expect(screen.getByText('Hello Ana')).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('shows the fallback while loading, and leaves the boundary to the caller with fallback false', async () => {
    let resolve: (module: { default: typeof Greeting }) => void = () => undefined;
    const pending = new Promise<{ default: typeof Greeting }>((done) => {
      resolve = done;
    });
    const Lazy = lazyComponent(() => pending, { name: 'Greeting', fallback: <p>Loading</p> });
    const Bare = lazyComponent(() => pending, { name: 'Greeting', fallback: false });

    render(<Lazy name="Ana" />);
    expect(screen.getByText('Loading')).toBeInTheDocument();

    await act(async () => resolve({ default: Greeting }));
    expect(await screen.findByText('Hello Ana')).toBeInTheDocument();
    expect(Bare.displayName).toBe('Lazy(Greeting)');
  });

  it('retries a module import failure with a growing delay, then renders', async () => {
    vi.useFakeTimers();
    const load = vi
      .fn<() => Promise<{ default: typeof Greeting }>>()
      .mockRejectedValueOnce(importFailure())
      .mockRejectedValueOnce(importFailure())
      .mockResolvedValue({ default: Greeting });
    const Lazy = lazyComponent(load, {
      name: 'Greeting',
      retry: { attempts: 3, baseDelayMs: 100 },
    });

    const loaded = Lazy.preload();
    await vi.advanceTimersByTimeAsync(100);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(200);
    await loaded;

    expect(load).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('throws any other error straight through, and imports again on the next ask', async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Greeting }>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ default: Greeting });
    const Lazy = lazyComponent(load, { name: 'Greeting' });

    await expect(Lazy.preload()).rejects.toThrow('boom');
    await Lazy.preload();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('hands a stale deploy to the recovery once retries are spent, and stays pending while the page reloads', async () => {
    const recover = vi.fn();
    setStaleDeployRecovery(recover);
    const Lazy = lazyComponent(
      async () => {
        throw importFailure();
      },
      { name: 'Greeting', retry: { attempts: 0, baseDelayMs: 0 } }
    );

    const outcome = await Promise.race([
      Lazy.preload().then(() => 'settled'),
      Promise.resolve('pending'),
    ]);

    expect(outcome).toBe('pending');
    expect(recover).toHaveBeenCalledOnce();
  });
});
