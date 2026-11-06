import { act, render, screen } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { lazyComponent } from '../lazy-component';
import { onStaleDeploy } from '../stale-deploy';

const Greeting = ({ name }: { name: string }) => <p>{`Hello ${name}`}</p>;
const importFailure = () =>
  new TypeError('Failed to fetch dynamically imported module: https://cdn.test/a.js');

class ErrorCatcher extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <p>{`failed: ${this.state.error.message}`}</p> : this.props.children;
  }
}

afterEach(() => {
  sessionStorage.clear();
});

describe('@vp/ui: lazyComponent', () => {
  it('imports the module once however it is asked, and renders it with its props', async () => {
    const load = vi.fn(async () => ({ default: Greeting }));
    const Lazy = lazyComponent(load, { name: 'Greeting', pick: (module) => module.default });

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
      pick: (module) => module.default,
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
    const Lazy = lazyComponent(() => pending, {
      name: 'Greeting',
      pick: (module) => module.default,
      fallback: <p>Loading</p>,
    });
    const Bare = lazyComponent(() => pending, {
      name: 'Greeting',
      pick: (module) => module.default,
      fallback: false,
    });

    render(<Lazy name="Ana" />);
    expect(screen.getByText('Loading')).toBeInTheDocument();

    await act(async () => resolve({ default: Greeting }));
    expect(await screen.findByText('Hello Ana')).toBeInTheDocument();
    expect(Bare.displayName).toBe('Lazy(Greeting)');
  });

  it('retries a failed import from a cache-busted URL, growing the delay, then renders', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValue(importFailure());
    const importUrl = vi
      .fn<(url: string) => Promise<{ default: typeof Greeting }>>()
      .mockRejectedValueOnce(importFailure())
      .mockResolvedValue({ default: Greeting });
    const Lazy = lazyComponent(load, {
      name: 'Greeting',
      pick: (module: { default: typeof Greeting }) => module.default,
      retry: { attempts: 3, baseDelayMs: 100 },
      importUrl,
    });

    const loaded = Lazy.preload();
    await vi.advanceTimersByTimeAsync(100);
    expect(importUrl).toHaveBeenLastCalledWith('https://cdn.test/a.js?vp-retry=1');
    await vi.advanceTimersByTimeAsync(200);
    await loaded;

    expect(importUrl).toHaveBeenLastCalledWith('https://cdn.test/a.js?vp-retry=2');
    expect(load).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('goes straight to the stale-deploy reload when the failure names no URL', async () => {
    const recover = vi.fn();
    const stop = onStaleDeploy(recover);
    const importUrl = vi.fn();
    const Lazy = lazyComponent(
      async () => {
        throw new TypeError('Importing a module script failed.');
      },
      {
        name: 'Greeting',
        pick: (module: { default: typeof Greeting }) => module.default,
        importUrl,
      }
    );

    void Lazy.preload();

    await vi.waitFor(() => expect(recover).toHaveBeenCalledOnce());
    expect(importUrl).not.toHaveBeenCalled();
    stop();
  });

  it('mounts after a failed load once a later one succeeds, instead of rethrowing the first failure', async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Greeting }>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ default: Greeting });
    const Lazy = lazyComponent(load, { name: 'Greeting', pick: (module) => module.default });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const failed = render(
      <ErrorCatcher>
        <Lazy name="Ana" />
      </ErrorCatcher>
    );
    expect(await screen.findByText('failed: boom')).toBeInTheDocument();
    failed.unmount();
    render(<Lazy name="Bo" />);

    expect(await screen.findByText('Hello Bo')).toBeInTheDocument();
  });

  it('throws any other error straight through, and imports again on the next ask', async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Greeting }>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue({ default: Greeting });
    const Lazy = lazyComponent(load, { name: 'Greeting', pick: (module) => module.default });

    await expect(Lazy.preload()).rejects.toThrow('boom');
    await Lazy.preload();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('hands a stale deploy to the recovery once retries are spent, and stays pending while the page reloads', async () => {
    const recover = vi.fn();
    const stop = onStaleDeploy(recover);
    const Lazy = lazyComponent(
      async () => {
        throw importFailure();
      },
      {
        name: 'Greeting',
        pick: (module: { default: typeof Greeting }) => module.default,
        retry: { attempts: 0, baseDelayMs: 0 },
      }
    );

    let settled = false;
    void Lazy.preload().then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    await vi.waitFor(() => expect(recover).toHaveBeenCalledOnce());
    expect(settled).toBe(false);
    stop();
  });
});
