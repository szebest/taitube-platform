import { type AnyProvider, createRegistry, type Token } from '@kit/di';
import { expectOk } from '@kit/testing/result';
import { browserRuntime } from '../browser';
import type { EnvRecord } from '../environment';
import { nodeRuntime } from '../node';

export function resolveFrom<T>(providers: AnyProvider[], wanted: Token<T>): T {
  return expectOk(
    createRegistry()
      .provide(...providers)
      .get(wanted)
  );
}

function cookieStoreOf(held: Readonly<Record<string, string>>): Pick<CookieStore, 'get'> {
  return {
    get: async (name) => {
      const key = typeof name === 'string' ? name : name?.name;
      const value = key === undefined ? undefined : held[key];
      return key === undefined || value === undefined ? null : { name: key, value };
    },
  };
}

export const providedBy = {
  node: (env: EnvRecord = {}) => nodeRuntime({ env }),
  browser: (env: EnvRecord = {}, held: Readonly<Record<string, string>> = {}) =>
    browserRuntime({ env, cookies: cookieStoreOf(held) }),
};
