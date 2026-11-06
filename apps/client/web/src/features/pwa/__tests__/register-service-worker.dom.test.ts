import { registerServiceWorker } from '../register-service-worker';

type Listener = () => void;

const workbox = vi.hoisted(() => ({
  listeners: new Map<string, Set<() => void>>(),
  register: vi.fn(),
  messageSkipWaiting: vi.fn(),
  constructed: [] as unknown[][],
}));

vi.mock('workbox-window', () => ({
  Workbox: class {
    constructor(...args: unknown[]) {
      workbox.constructed.push(args);
    }
    register = workbox.register;
    messageSkipWaiting = workbox.messageSkipWaiting;
    addEventListener(name: string, listener: Listener) {
      workbox.listeners.set(name, (workbox.listeners.get(name) ?? new Set()).add(listener));
    }
    removeEventListener(name: string, listener: Listener) {
      workbox.listeners.get(name)?.delete(listener);
    }
  },
}));

const emit = (name: string) => {
  for (const listener of workbox.listeners.get(name) ?? []) {
    listener();
  }
};

const stops: Array<() => void> = [];

function register() {
  const onWaiting = vi.fn();
  const reload = vi.fn();
  const stop = registerServiceWorker({ onWaiting, doc: document, reload });
  stops.push(stop);
  return { onWaiting, reload, stop };
}

describe('apps/client/web: registerServiceWorker', () => {
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });

  beforeEach(() => {
    workbox.listeners.clear();
    workbox.constructed.length = 0;
    workbox.register.mockReset().mockResolvedValue(undefined);
    workbox.messageSkipWaiting.mockReset();
  });

  it('registers /sw.js with the whole origin as its scope', () => {
    register();

    expect(workbox.constructed).toEqual([['/sw.js', { scope: '/' }]]);
    expect(workbox.register).toHaveBeenCalledOnce();
  });

  it('survives a failed registration', async () => {
    workbox.register.mockRejectedValue(new Error('blocked'));

    expect(() => register()).not.toThrow();
    await Promise.resolve();
  });

  it('asks the waiting worker to take over only once the viewer activates, then reloads', () => {
    const { onWaiting, reload } = register();

    emit('waiting');
    expect(workbox.messageSkipWaiting).not.toHaveBeenCalled();

    onWaiting.mock.calls[0]?.[0]();
    expect(workbox.messageSkipWaiting).toHaveBeenCalledOnce();

    emit('controlling');
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not reload when the first worker takes control', () => {
    const { reload } = register();

    emit('controlling');

    expect(reload).not.toHaveBeenCalled();
  });

  it.each([
    { case: 'one is already waiting', waiting: {}, reloads: 0 },
    { case: 'none waits', waiting: null, reloads: 1 },
  ])(
    'recovers from a stale deploy by activating a waiting worker when $case',
    async ({ waiting, reloads }) => {
      vi.useFakeTimers();
      const update = vi.fn().mockResolvedValue(undefined);
      workbox.register.mockResolvedValue({ update, waiting });
      const { reload, onWaiting, stop } = register();

      window.dispatchEvent(new Event('vp:stale-deploy', { cancelable: true }));
      emit('waiting');
      await vi.advanceTimersByTimeAsync(5000);

      expect(update).toHaveBeenCalledOnce();
      expect(workbox.register).toHaveBeenCalledOnce();
      expect(workbox.messageSkipWaiting).toHaveBeenCalledTimes(1 - reloads);
      expect(reload).toHaveBeenCalledTimes(reloads);
      expect(onWaiting).not.toHaveBeenCalled();
      stop();
      vi.useRealTimers();
    }
  );

  it('stops listening on cleanup', () => {
    const { onWaiting, stop } = register();

    stop();
    emit('waiting');

    expect(onWaiting).not.toHaveBeenCalled();
  });
});
