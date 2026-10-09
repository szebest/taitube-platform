import { fromPromise, isOk } from '@vp/result';
import { useEffect, useState } from 'react';

// react-player 2 fetches hls.js from cdn.jsdelivr.net unless window.Hls already holds it.
export function useBundledHls(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    fromPromise(
      () => import('hls.js'),
      (cause) => cause
    ).then((loaded) => {
      if (!isOk(loaded)) return;
      Object.assign(window, { Hls: loaded.value.default });
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return ready;
}
