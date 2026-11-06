import { SYNC_CHANNEL } from '#app/sw/sync-messages';
import { clearQueuedChanges } from '../clear-queued-changes';

describe('apps/client/web: clearQueuedChanges', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks the worker on the sync channel to drop its queue, then closes', () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    const channel = vi.fn(function Channel() {
      return { postMessage, close };
    });
    vi.stubGlobal('BroadcastChannel', channel);

    clearQueuedChanges();

    expect(channel).toHaveBeenCalledWith(SYNC_CHANNEL);
    expect(postMessage).toHaveBeenCalledWith({ type: 'clear-queue' });
    expect(close).toHaveBeenCalled();
  });

  it('does nothing without BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined);

    expect(() => clearQueuedChanges()).not.toThrow();
  });
});
