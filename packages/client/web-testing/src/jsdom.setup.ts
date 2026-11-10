import type { createIsomorphicFn } from '@tanstack/react-start';
import { parse, serialize } from 'cookie-es';
import { installTextTracks } from './text-tracks';

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
  readonly scrollMargin = '0px';
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
// @vp/ui call them while rendering or handling a key.
window.matchMedia = unmatchedQuery;
window.scrollTo = () => undefined;
window.IntersectionObserver = NeverIntersecting;
window.ResizeObserver = UnobservedSize;
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.scrollTo = () => undefined;
Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
installTextTracks();

// Nor Web Locks: a lock that is never granted leaves every rendered app a tab that follows the
// user event stream, so none opens the EventSource jsdom also lacks.
const neverGranted: LockManager = {
  request: () => new Promise<never>(() => undefined),
  query: async () => ({ held: [], pending: [] }),
};
Object.defineProperty(navigator, 'locks', { configurable: true, value: neverGranted });

// The Start compiler keeps only an isomorphic function's `.client` branch in the browser bundle;
// uncompiled, the runtime stub always runs `.server`.
const browserIsomorphicFn: typeof createIsomorphicFn = () => ({
  server: <TArgs extends unknown[], TServer>(_serverImpl: (...args: TArgs) => TServer) =>
    Object.assign((..._args: TArgs) => undefined, {
      client: <TClient>(clientImpl: (...args: TArgs) => TClient) => clientImpl,
    }),
  client: (clientImpl) => Object.assign(clientImpl, { server: () => clientImpl }),
});

vi.mock(import('@tanstack/react-start'), async (importOriginal) => {
  const start = await importOriginal();
  const { overCookieRequest } = await import('./server-functions');
  return {
    ...start,
    createIsomorphicFn: browserIsomorphicFn,
    createServerFn: overCookieRequest(start),
  };
});

// Node's BroadcastChannel reaches the other test files running in worker threads of the same process, so the app's own channels are named per file.
const PerFileBroadcastChannel = ((Native, scope) =>
  class extends Native {
    constructor(name: string) {
      super(name.startsWith('vp.') ? `${scope}:${name}` : name);
    }
  })(globalThis.BroadcastChannel, crypto.randomUUID());
Object.defineProperty(globalThis, 'BroadcastChannel', {
  value: PerFileBroadcastChannel,
  configurable: true,
});

// A server function sets cookies in jsdom's jar, and the stores keep what a preference or an intent wrote, all of which outlive the test.
afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  for (const name of Object.keys(parse(document.cookie))) {
    // oxlint-disable-next-line unicorn/no-document-cookie -- jsdom's jar is where the server functions keep the cookies.
    document.cookie = serialize(name, '', { maxAge: 0, path: '/' });
  }
});
