/**
 * The browser half of `@tanstack/react-start`, which a Storybook build cannot load: `@vp/ui` reads
 * its cookies through `createIsomorphicFn`, and a story only ever runs the client side of one.
 * A package a story reaches is bundled whole, so the server-only names it imports exist here and do nothing.
 */
export function createIsomorphicFn() {
  const chain = {
    server: () => chain,
    client: <T>(implementation: T) => implementation,
  };
  return chain;
}

export const createServerFn = () => ({
  handler: <T>(implementation: T) => implementation,
});

export const createMiddleware = () => ({
  server: () => undefined,
});

export const getGlobalStartContext = (): undefined => undefined;
export const createCsrfMiddleware = () => undefined;
export const getRequestIP = (): undefined => undefined;
export const getRequest = (): undefined => undefined;
export const getRequestHeader = (): undefined => undefined;
export const getCookie = (): undefined => undefined;
export const setCookie = (): undefined => undefined;
export const deleteCookie = (): undefined => undefined;
