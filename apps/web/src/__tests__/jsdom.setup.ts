function unmatchedQuery(media: string): MediaQueryList {
  return {
    media,
    matches: false,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  };
}

class NeverIntersecting implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

class UnobservedSize implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// jsdom implements none of these; the legacy chrome, the router and the Radix primitives in
// components/ui call them while rendering or handling a key.
window.matchMedia = unmatchedQuery;
window.scrollTo = () => undefined;
window.IntersectionObserver = NeverIntersecting;
window.ResizeObserver = UnobservedSize;
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
