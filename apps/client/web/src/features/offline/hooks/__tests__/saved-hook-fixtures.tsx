import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { fakeCacheStorage } from '#app/__tests__/fake-cache-storage';
import { supportOffline } from '#app/__tests__/offline-support';
import { CACHE_NAMES } from '#app/sw/cache-names';

export function queryWrapper() {
  const client = new QueryClient();
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

export async function supportedStorageHolding(videos: object[]) {
  const storage = fakeCacheStorage();
  supportOffline(storage);
  await (await storage.open(CACHE_NAMES.saved)).put('/_saved/index.json', Response.json(videos));
  return storage;
}
