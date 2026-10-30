import { useEffect, useState } from 'react';
import type { VideoCardHover } from './types';

const EXPAND_DELAY_MS = 500;

export function useVideoCardHover() {
  const [hover, setHover] = useState<VideoCardHover>('idle');

  useEffect(() => {
    if (hover === 'idle') {
      return;
    }

    const cancel = () => setHover('idle');
    const timer =
      hover === 'waiting'
        ? window.setTimeout(() => setHover('expanded'), EXPAND_DELAY_MS)
        : undefined;
    window.addEventListener('scroll', cancel, { capture: true, passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', cancel, { capture: true });
    };
  }, [hover]);

  return {
    expanded: hover === 'expanded',
    wait: () => setHover('waiting'),
    cancel: () => setHover('idle'),
  };
}
