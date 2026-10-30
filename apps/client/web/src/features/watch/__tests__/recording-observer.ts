import { act } from '@testing-library/react';

/** An `IntersectionObserver` that reports nothing until a spec says the page has scrolled to it. */
export class RecordingObserver implements IntersectionObserver {
  static all: RecordingObserver[] = [];
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
    vi.stubGlobal('IntersectionObserver', RecordingObserver);
  }

  static enterView(): void {
    for (const observer of RecordingObserver.all) {
      act(() =>
        observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer)
      );
    }
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
