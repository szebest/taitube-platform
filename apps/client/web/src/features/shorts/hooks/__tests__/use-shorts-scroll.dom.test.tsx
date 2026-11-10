import { act, fireEvent, render, screen } from '@testing-library/react';
import { useShortsScroll } from '../use-shorts-scroll';

const HEIGHT = 800;

/** Only the feed has a height; jsdom lays nothing out. */
function stubHeight(height: number) {
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return this.getAttribute('aria-label') === 'Feed' ? height : 0;
  });
}

const resizes: Array<() => void> = [];

class CapturedResize implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizes.push(() => callback([], this));
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function Harness({
  count,
  initialIndex,
  onIndexChange,
}: {
  count: number;
  initialIndex: number;
  onIndexChange: (index: number) => void;
}) {
  const { index, attach, goTo, handlers } = useShortsScroll({ count, initialIndex, onIndexChange });

  return (
    <section ref={attach} aria-label="Feed" {...handlers}>
      <output>{index}</output>
      <button type="button" onClick={() => goTo(index + 1)}>
        Next
      </button>
      <button type="button" onClick={() => goTo(index - 1)}>
        Previous
      </button>
    </section>
  );
}

function renderScroll({ count = 4, initialIndex = 0 } = {}) {
  const onIndexChange = vi.fn();
  const scrollTo = vi.spyOn(Element.prototype, 'scrollTo');
  render(<Harness count={count} initialIndex={initialIndex} onIndexChange={onIndexChange} />);
  const feed = screen.getByRole('region', { name: 'Feed' });

  const restAt = (position: number) => {
    feed.scrollTop = position * HEIGHT;
    fireEvent.scroll(feed);
  };

  return { feed, onIndexChange, scrollTo, restAt };
}

describe('apps/client/web: useShortsScroll', () => {
  beforeEach(() => {
    resizes.length = 0;
    stubHeight(HEIGHT);
    vi.stubGlobal('ResizeObserver', CapturedResize);
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-motion');
  });

  it('opens on the Short it is given, a whole screen per Short down', () => {
    const { feed } = renderScroll({ initialIndex: 2 });

    expect(feed.scrollTop).toBe(2 * HEIGHT);
    expect(screen.getByRole('status')).toHaveTextContent('2');
  });

  it.each([
    { scenario: 'smoothly', motion: undefined, behavior: 'smooth' },
    { scenario: 'at once under the reduced motion set', motion: 'reduced', behavior: 'auto' },
  ])('moves to the next Short $scenario and says so at once', async ({ motion, behavior }) => {
    if (motion) document.documentElement.setAttribute('data-motion', motion);
    const { scrollTo, onIndexChange } = renderScroll();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(scrollTo).toHaveBeenCalledWith({ top: HEIGHT, behavior });
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(screen.getByRole('status')).toHaveTextContent('1');
  });

  it.each([
    { scenario: 'before the first', initialIndex: 0, button: 'Previous' },
    { scenario: 'past the last', initialIndex: 3, button: 'Next' },
  ])('stays put when asked to go $scenario', ({ initialIndex, button }) => {
    const { onIndexChange, scrollTo } = renderScroll({ initialIndex });

    fireEvent.click(screen.getByRole('button', { name: button }));

    expect(scrollTo).not.toHaveBeenCalled();
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('reports the Short the container came to rest on after a swipe', () => {
    const { restAt, onIndexChange } = renderScroll();

    restAt(2);

    expect(onIndexChange).toHaveBeenCalledExactlyOnceWith(2);
    expect(screen.getByRole('status')).toHaveTextContent('2');
  });

  it('reports a Short once it fills more than half the container', () => {
    const { feed, onIndexChange } = renderScroll();

    feed.scrollTop = HEIGHT * 0.4;
    fireEvent.scroll(feed);
    expect(onIndexChange).not.toHaveBeenCalled();

    feed.scrollTop = HEIGHT * 0.6;
    fireEvent.scroll(feed);
    expect(onIndexChange).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('ignores the scroll on the way to a Short a key asked for, until it arrives', () => {
    const { feed, onIndexChange, restAt } = renderScroll();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    onIndexChange.mockClear();

    feed.scrollTop = HEIGHT * 0.2;
    fireEvent.scroll(feed);
    restAt(1);
    restAt(2);

    expect(onIndexChange).toHaveBeenCalledExactlyOnceWith(2);
  });

  it.each([
    { gesture: 'a touch', fire: (feed: HTMLElement) => fireEvent.touchStart(feed) },
    { gesture: 'a wheel', fire: (feed: HTMLElement) => fireEvent.wheel(feed) },
  ])('lets $gesture take the scroll back from a move in flight', ({ fire }) => {
    const { feed, onIndexChange } = renderScroll();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    onIndexChange.mockClear();

    fire(feed);
    feed.scrollTop = HEIGHT * 2;
    fireEvent.scroll(feed);

    expect(onIndexChange).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('reads nothing while the container has no height', () => {
    stubHeight(0);
    const { feed, onIndexChange } = renderScroll();

    fireEvent.scroll(feed);

    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('keeps the Short in view when the container is resized', () => {
    const { feed } = renderScroll({ initialIndex: 1 });
    stubHeight(500);

    act(() => {
      for (const resize of resizes) resize();
    });

    expect(feed.scrollTop).toBe(500);
  });
});
