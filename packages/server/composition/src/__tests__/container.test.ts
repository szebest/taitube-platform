import { err, ok } from '@vp/result';
import { expectErr, expectOk } from '@vp/testing/result';
import { Container, closeOnDispose } from '../container';
import { token } from '../token';

class VideoService {
  constructor(readonly storage: string) {}
}

const Config = token<{ bucket: string }>('Config');
const Storage = token<string>('Storage');
const Multipart = token<string>('Multipart');
const VideoServiceToken = token<VideoService>('VideoService');

function recorder() {
  const calls: string[] = [];
  const lifecycle = (name: string, failStart = false) => ({
    start: async () => {
      calls.push(`start ${name}`);
      return failStart ? err(`${name} is down`) : ok();
    },
    dispose: () => {
      calls.push(`dispose ${name}`);
    },
  });
  return { calls, lifecycle };
}

describe('packages/composition: Container', () => {
  it('types a resolution by its token, with no type argument and no cast', () => {
    const c = new Container()
      .provide(Storage, () => 'raw')
      .provide(VideoServiceToken, (c) => new VideoService(c.get(Storage)));

    const service: VideoService = c.get(VideoServiceToken);

    expect(service.storage).toBe('raw');
  });

  it('invokes a factory at most once, and never one that is not resolved', () => {
    const storage = vi.fn(() => 'raw');
    const multipart = vi.fn(() => 'parts');
    const c = new Container().provide(Storage, storage).provide(Multipart, multipart);

    c.get(Storage);
    c.get(Storage);

    expect(storage).toHaveBeenCalledTimes(1);
    expect(multipart).not.toHaveBeenCalled();
  });

  it('names every token on a cycle, in resolution order', () => {
    const c = new Container()
      .provide(Config, (c) => ({ bucket: c.get(Storage) }))
      .provide(Storage, (c) => c.get(Multipart))
      .provide(Multipart, (c) => c.get(Storage));

    expect(() => c.get(Config)).toThrow('Config → Storage → Multipart → Storage');
  });

  it('refuses a token nobody provided, by name', () => {
    expect(() => new Container().get(Storage)).toThrow('No provider for Storage');
  });

  it('lets an override placed before resolution win', () => {
    const c = new Container().provide(Storage, () => 'raw').override(Storage, 'fake');

    expect(c.get(Storage)).toBe('fake');
  });

  it.each([
    { scenario: 'override', act: (c: Container) => c.override(Storage, 'late') },
    { scenario: 'provide', act: (c: Container) => c.provide(Storage, () => 'late') },
  ])('refuses to $scenario a token that is already resolved', ({ act }) => {
    const c = new Container().provide(Storage, () => 'raw');
    c.get(Storage);

    expect(() => act(c)).toThrow('Storage');
  });

  it('refuses an async factory at registration, naming the token', () => {
    const asyncFactory = (async () => 'raw') as unknown as () => string;

    expect(() => new Container().provide(Storage, asyncFactory)).toThrow('Storage');
  });

  it('keeps resolving after a factory throws', () => {
    let attempts = 0;
    const c = new Container().provide(Storage, () => {
      attempts += 1;
      if (attempts === 1) throw new Error('not yet');
      return 'raw';
    });

    expect(() => c.get(Storage)).toThrow('not yet');
    expect(c.get(Storage)).toBe('raw');
  });

  it('refuses a factory that hands back a promise, naming the token', () => {
    const promised = (() => Promise.resolve('raw')) as unknown as () => string;
    const c = new Container().provide(Storage, promised);

    expect(() => c.get(Storage)).toThrow('Storage');
  });

  it('starts only what was resolved, in construction order', async () => {
    const { calls, lifecycle } = recorder();
    const c = new Container()
      .provide(Storage, () => 'raw', lifecycle('Storage'))
      .provide(Multipart, (c) => `${c.get(Storage)}-parts`, lifecycle('Multipart'))
      .provide(Config, () => ({ bucket: 'unused' }), lifecycle('Config'));
    c.get(Multipart);

    expectOk(await c.start());

    expect(calls).toEqual(['start Storage', 'start Multipart']);
  });

  it('disposes what it started when a start fails, and returns the failure', async () => {
    const { calls, lifecycle } = recorder();
    const c = new Container()
      .provide(Storage, () => 'raw', lifecycle('Storage'))
      .provide(Multipart, (c) => `${c.get(Storage)}-parts`, lifecycle('Multipart', true));
    c.get(Multipart);

    const failed = expectErr(await c.start());

    expect(failed).toEqual({ token: 'Multipart', cause: 'Multipart is down' });
    expect(calls).toEqual([
      'start Storage',
      'start Multipart',
      'dispose Multipart',
      'dispose Storage',
    ]);
  });

  it('disposes in reverse construction order, and only what a factory built', async () => {
    const { calls, lifecycle } = recorder();
    const c = new Container()
      .provide(Storage, () => 'raw', lifecycle('Storage'))
      .provide(Config, () => ({ bucket: 'b' }), lifecycle('Config'))
      .provide(Multipart, (c) => `${c.get(Storage)}-parts`, lifecycle('Multipart'))
      .override(Config, { bucket: 'handed-in' });
    c.get(Config);
    c.get(Multipart);

    expectOk(await c.dispose());

    expect(calls).toEqual(['dispose Multipart', 'dispose Storage']);
  });

  it('runs every disposer and names each one that failed', async () => {
    const closed: string[] = [];
    const c = new Container()
      .provide(Storage, () => 'raw', { dispose: () => void closed.push('Storage') })
      .provide(Multipart, () => 'parts', {
        dispose: () => {
          throw new Error('socket already gone');
        },
      })
      .provide(Config, () => ({ bucket: 'b' }), { dispose: async () => err('flush failed') });
    c.get(Storage);
    c.get(Multipart);
    c.get(Config);

    const failed = expectErr(await c.dispose());

    expect(failed.failed.map((f) => f.token)).toEqual(['Config', 'Multipart']);
    expect(closed).toEqual(['Storage']);
  });

  it('closes each resource exactly once when disposed twice', async () => {
    const dispose = vi.fn();
    const c = new Container().provide(Storage, () => 'raw', { dispose });
    c.get(Storage);

    await Promise.all([c.dispose(), c.dispose()]);
    await c.dispose();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('names the disposer it is still waiting on', async () => {
    let release = () => {};
    const c = new Container().provide(Storage, () => 'raw', {
      dispose: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });
    c.get(Storage);

    const disposal = c.dispose();
    await Promise.resolve();

    expect(c.disposing()).toBe('Storage');
    release();
    await disposal;
    expect(c.disposing()).toBeUndefined();
  });
});

describe('packages/composition: closeOnDispose', () => {
  it('disposes a resource by closing it', async () => {
    const close = vi.fn(async () => ok());
    const c = new Container().provide(
      Storage,
      () => Object.assign('raw', { close }),
      closeOnDispose
    );
    c.get(Storage);

    expectOk(await c.dispose());

    expect(close).toHaveBeenCalledTimes(1);
  });
});
