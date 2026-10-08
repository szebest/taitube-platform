import { cleanup } from '@testing-library/react';
import type { Options } from '@testing-library/user-event';

import { bindScreen } from './bind-screen';

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

// jsdom implements none of these; the legacy chrome and the router call them while rendering.
window.matchMedia = unmatchedQuery;
window.scrollTo = () => undefined;
window.IntersectionObserver = NeverIntersecting;

// Spec files share a worker's modules but each gets a new document; both libraries bind the first,
// and Testing Library's own cleanup registers for the first file only, hence RTL_SKIP_AUTO_CLEANUP.
bindScreen();
afterEach(cleanup);

vi.mock(import('@testing-library/user-event'), async (importOriginal) => {
  const actual = await importOriginal();
  const userEvent = {
    ...actual.userEvent,
    setup: (options: Options = {}) => actual.userEvent.setup({ document, ...options }),
  };
  return { ...actual, userEvent, default: userEvent };
});
