import { SlotRectStore } from '../slot-rect-store';

function slotAt(left: number, top: number, width: number, height: number) {
  const slot = document.createElement('div');
  document.body.append(slot);
  const place = (next: { left?: number; top?: number }) => {
    left = next.left ?? left;
    top = next.top ?? top;
  };
  vi.spyOn(slot, 'getBoundingClientRect').mockImplementation(
    () => ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
  );
  return { slot, place };
}

describe('apps/client/web: SlotRectStore', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute('dir');
  });

  it('has no place until it follows a slot, and hands the slot box over once it does', () => {
    const store = new SlotRectStore();
    expect(store.snapshot()).toBeUndefined();

    store.track(slotAt(10, 20, 300, 169).slot);

    expect(store.snapshot()).toEqual({ x: 10, y: 20, width: 300, height: 169 });
  });

  it('follows a scroll and a resize, telling its readers only when a number changed', () => {
    const store = new SlotRectStore();
    const { slot, place } = slotAt(10, 20, 300, 169);
    store.track(slot);
    const listener = vi.fn();
    const stop = store.subscribe(listener);

    window.dispatchEvent(new Event('scroll'));
    expect(listener).not.toHaveBeenCalled();

    place({ top: -40 });
    window.dispatchEvent(new Event('scroll'));
    expect(store.snapshot()).toMatchObject({ y: -40 });
    expect(listener).toHaveBeenCalledOnce();

    place({ left: 50 });
    window.dispatchEvent(new Event('resize'));
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    place({ top: 0 });
    window.dispatchEvent(new Event('scroll'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('hands out the same object until a number changes', () => {
    const store = new SlotRectStore();
    store.track(slotAt(1, 2, 3, 4).slot);
    const first = store.snapshot();

    window.dispatchEvent(new Event('resize'));

    expect(store.snapshot()).toBe(first);
  });

  it('forgets the place when it follows nothing', () => {
    const store = new SlotRectStore();
    store.track(slotAt(1, 2, 3, 4).slot);

    store.track(undefined);

    expect(store.snapshot()).toBeUndefined();
  });

  it('measures from the right edge in a right-to-left page', () => {
    document.documentElement.dir = 'rtl';
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    const store = new SlotRectStore();

    store.track(slotAt(700, 20, 300, 169).slot);

    expect(store.snapshot()).toMatchObject({ x: 0, width: 300 });
  });

  it('stops observing the slot it left', () => {
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = disconnect;
      }
    );
    const store = new SlotRectStore();

    store.track(slotAt(1, 2, 3, 4).slot)();

    expect(disconnect).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
