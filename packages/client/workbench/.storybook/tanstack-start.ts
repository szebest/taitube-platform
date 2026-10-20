/**
 * The browser half of `@tanstack/react-start`, which a Storybook build cannot load: `@vp/ui` reads
 * its cookies through `createIsomorphicFn`, and a story only ever runs the client side of one.
 */
export function createIsomorphicFn() {
  const chain = {
    server: () => chain,
    client: <T>(implementation: T) => implementation,
  };
  return chain;
}

export const getCookie = (): undefined => undefined;
