import { fromPromise, isOk } from '@vp/result';
import { useEffect, useState } from 'react';
import { NOTHING_CACHED, type OfflineCache, readOfflineCache } from './offline-cache';

/** What is available offline, read from CacheStorage once on the client; empty on the server. */
export function useOfflineCache(): OfflineCache {
  const [cache, setCache] = useState(NOTHING_CACHED);

  useEffect(() => {
    if (!Reflect.has(window, 'caches')) {
      return;
    }

    let current = true;
    void fromPromise(readOfflineCache(window.caches), (cause) => cause).then((read) => {
      if (current && isOk(read)) {
        setCache(read.value);
      }
    });
    return () => {
      current = false;
    };
  }, []);

  return cache;
}
