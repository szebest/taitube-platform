import { createQueryClient } from '../create-query-client';
import { createIdentityStore, parseIdentityState } from '../identity-store';

const ON_SLOT_0 = { identity: { slot: 0 }, prefixed: false };

describe('@vp/queries: identity store', () => {
  it("switches to a new identity with a cache of its own, cancelling the last one's loads", () => {
    const first = createQueryClient();
    first.setDefaultOptions({ queries: { retry: false } });
    const cancel = vi.spyOn(first, 'cancelQueries');
    const clear = vi.spyOn(first, 'clear');
    const store = createIdentityStore(ON_SLOT_0, first);
    const notified = vi.fn();
    store.subscribe(notified);

    const next = store.switchTo({ identity: { slot: 1, channel: 'two' }, prefixed: true });

    expect(next).not.toBe(first);
    expect(store.queryClient()).toBe(next);
    expect(next.getDefaultOptions().queries?.retry).toBe(false);
    expect(cancel).toHaveBeenCalledOnce();
    expect(clear).not.toHaveBeenCalled();
    expect(store.read()).toEqual({ identity: { slot: 1, channel: 'two' }, prefixed: true });
    expect(store.key()).toBe('1.two');
    expect(notified).toHaveBeenCalledOnce();
  });

  it('renews the cache of the same identity', () => {
    const store = createIdentityStore(ON_SLOT_0);
    const first = store.queryClient();

    expect(store.renew()).not.toBe(first);
    expect(store.read()).toEqual(ON_SLOT_0);
  });

  it('takes the hydrated identity and later a prefix, keeping the cache', () => {
    const store = createIdentityStore(ON_SLOT_0);
    const cache = store.queryClient();

    store.hydrate({ identity: { slot: 4 }, prefixed: false });
    store.markPrefixed();

    expect(store.read()).toEqual({ identity: { slot: 4 }, prefixed: true });
    expect(store.queryClient()).toBe(cache);
  });

  it('stops telling a listener that unsubscribed', () => {
    const store = createIdentityStore(ON_SLOT_0);
    const notified = vi.fn();

    store.subscribe(notified)();
    store.renew();

    expect(notified).not.toHaveBeenCalled();
  });

  it.each([
    {
      raw: '{"identity":{"slot":2},"prefixed":true}',
      state: { identity: { slot: 2 }, prefixed: true },
    },
    { raw: '{"identity":{"slot":12},"prefixed":true}', state: undefined },
    { raw: 'nope', state: undefined },
    { raw: undefined, state: undefined },
  ])('reads the dehydrated $raw as $state', ({ raw, state }) => {
    expect(parseIdentityState(raw)).toEqual(state);
  });
});
