import type { ApiClient } from '@vp/api-client';
import { type PropsWithChildren, createContext, useContext } from 'react';

const ApiContext = createContext<ApiClient | undefined>(undefined);

export type ApiProviderProps = PropsWithChildren<{ api: ApiClient }>;

/** Hands components the client the app's router built, the one its loaders read from context. */
export function ApiProvider({ api, children }: ApiProviderProps) {
  return <ApiContext value={api}>{children}</ApiContext>;
}

export function useApi(): ApiClient {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return api;
}
