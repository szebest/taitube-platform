import { err, ok, type Result } from '@vp/result';
import type { Token } from './token';

/** `Provider<T>` is invariant in `T`, so a list of providers of different types takes this. */
export interface AnyProvider {
  readonly token: Pick<Token<unknown>, 'name'>;
  readonly value: unknown;
}

export interface Provider<T> extends AnyProvider {
  readonly token: Token<T>;
  readonly value: T;
}

export interface MissingProvider {
  readonly code: 'MISSING_PROVIDER';
  readonly token: string;
  readonly message: string;
}

export interface Registry {
  provide(...providers: readonly AnyProvider[]): Registry;
  get<T>(token: Token<T>): Result<T, MissingProvider>;
}

export const provide = <T>(token: Token<T>, value: T): Provider<T> => ({ token, value });

function registryOf(providers: readonly AnyProvider[]): Registry {
  return Object.freeze({
    provide: (...more: readonly AnyProvider[]) => registryOf([...more, ...providers]),
    get: <T>(wanted: Token<T>): Result<T, MissingProvider> => {
      const found = providers.find((p): p is Provider<T> => p.token === wanted);
      return found
        ? ok(found.value)
        : err({
            code: 'MISSING_PROVIDER',
            token: wanted.name,
            message: `No provider for ${wanted.name}`,
          });
    },
  });
}

export const createRegistry = (): Registry => registryOf([]);
