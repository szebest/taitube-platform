import { type Context, createContext, useContext } from 'react';

/**
 * The context a compound component's root shares with its parts, and the hook a part reads it
 * with: `useCard('Header')` outside `Card.Root` throws `Card.Header must be inside Card.Root`.
 * The hook is exported too, so an app can write a part of its own over the root's state.
 */
export function createCompoundContext<Value>(
  root: string
): readonly [Context<Value | undefined>, (part?: string) => Value] {
  const CompoundContext = createContext<Value | undefined>(undefined);

  const useCompound = (part?: string): Value => {
    const value = useContext(CompoundContext);
    if (value === undefined) {
      const name = part === undefined ? `A ${root} part` : `${root}.${part}`;
      throw new Error(`${name} must be inside ${root}.Root`);
    }
    return value;
  };

  return [CompoundContext, useCompound];
}
