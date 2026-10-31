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

function register() {
  const onWaiting = vi.fn();
  const reload = vi.fn();
  const stop = registerServiceWorker({ onWaiting, doc: document, reload });
  return { onWaiting, reload, stop };
}

describe('apps/client/web: registerServiceWorker', () => {
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

  it('stops listening on cleanup', () => {
    const { onWaiting, stop } = register();

    stop();
    emit('waiting');

    expect(onWaiting).not.toHaveBeenCalled();
  });
});
