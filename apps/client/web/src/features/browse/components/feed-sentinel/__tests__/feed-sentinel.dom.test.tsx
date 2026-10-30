import { act, render } from '@testing-library/react';

import { FeedSentinel } from '../feed-sentinel';

class RecordingObserver implements IntersectionObserver {
  static latest: RecordingObserver | undefined;
  readonly root = null;
  readonly rootMargin: string;
  readonly scrollMargin = '0px';
  readonly thresholds = [0];
  disconnected = false;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {}
  ) {
    this.rootMargin = options.rootMargin ?? '0px';
    RecordingObserver.latest = this;
  }

  report(isIntersecting: boolean): void {
    act(() => this.callback([{ isIntersecting } as IntersectionObserverEntry], this));
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

describe('apps/client/web: FeedSentinel', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', RecordingObserver);
    RecordingObserver.latest = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for more only once it is within two rows of the viewport', () => {
    const onNear = vi.fn();
    render(<FeedSentinel onNear={onNear} />);

    RecordingObserver.latest?.report(false);
    expect(onNear).not.toHaveBeenCalled();

    RecordingObserver.latest?.report(true);
    expect(onNear).toHaveBeenCalledOnce();
    expect(RecordingObserver.latest?.rootMargin).toBe('0px 0px 1200px 0px');
  });

  it('stops observing when it unmounts', () => {
    const { unmount } = render(<FeedSentinel onNear={vi.fn()} />);

    unmount();

    expect(RecordingObserver.latest?.disconnected).toBe(true);
  });
});
