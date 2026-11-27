import { act } from '@testing-library/react';

/** An `IntersectionObserver` that reports nothing until a spec says the page has scrolled to it, then reports every observer, including one that observes later. */
export class RecordingObserver implements IntersectionObserver {
  static all: RecordingObserver[] = [];
  private static entered = false;
  readonly root = null;
  readonly rootMargin: string;
  readonly scrollMargin = '0px';
  readonly thresholds = [0];

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {}
  ) {
    this.rootMargin = options.rootMargin ?? '0px';
    RecordingObserver.all.push(this);
  }

  static install(): void {
    RecordingObserver.all = [];
    RecordingObserver.entered = false;
    vi.stubGlobal('IntersectionObserver', RecordingObserver);
  }

  static enterView(): void {
    RecordingObserver.entered = true;
    for (const observer of RecordingObserver.all) {
      observer.report();
    }
  }

  observe(): void {
    if (RecordingObserver.entered) {
      queueMicrotask(() => this.report());
    }
  }

  private report(): void {
    act(() => this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this));
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
