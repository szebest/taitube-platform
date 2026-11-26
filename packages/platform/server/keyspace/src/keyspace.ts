/** One key under a namespace: its parts joined with `:` after the namespace. */
export type KeyNamespace<N extends string> = (
  ...parts: readonly [string, ...string[]]
) => `${N}:${string}`;

type KeyLayout = Readonly<Record<string, string | ((...args: never[]) => string)>>;

/**
 * The app's key layout under one namespace, frozen. `define` builds every key through the namespace it is
 * handed, so no key is written by hand and a second app lays out its own keys under another namespace.
 */
export function defineKeyspace<const N extends string, const K extends KeyLayout>(
  namespace: N,
  define: (key: KeyNamespace<N>) => K
): Readonly<K> {
  const key: KeyNamespace<N> = (...parts) => `${namespace}:${parts.join(':')}`;
  return Object.freeze(define(key));
}
