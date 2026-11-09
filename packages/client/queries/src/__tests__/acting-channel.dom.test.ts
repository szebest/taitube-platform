import { ACTING_CHANNEL_COOKIE, createActingChannelStore } from '../acting-channel';

const CHANNEL = '00000000-0000-7000-8000-0000000000c1';

describe('@vp/queries: acting channel store in the browser', () => {
  afterEach(() => {
    createActingChannelStore().select(undefined);
  });

  it('keeps the selected channel in a cookie the next page load starts from', () => {
    createActingChannelStore().select(CHANNEL);

    expect(document.cookie).toContain(`${ACTING_CHANNEL_COOKIE}=${CHANNEL}`);
    expect(createActingChannelStore().read()).toBe(CHANNEL);
  });

  it('forgets the channel once it is cleared', () => {
    const store = createActingChannelStore();
    store.select(CHANNEL);

    store.select(undefined);

    expect(store.read()).toBeUndefined();
    expect(createActingChannelStore().read()).toBeUndefined();
  });

  it('tells a subscriber when the channel changes, and not after it unsubscribes', () => {
    const store = createActingChannelStore();
    const onChange = vi.fn();
    const unsubscribe = store.subscribe(onChange);

    store.select(CHANNEL);
    unsubscribe();
    store.select(undefined);

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
