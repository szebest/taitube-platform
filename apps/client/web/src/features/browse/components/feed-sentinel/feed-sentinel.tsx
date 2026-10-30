import { useEffect, useEffectEvent, useRef } from 'react';

/** About two rows of cards below the fold, so the next page is in before the sentinel shows. */
const PREFETCH_MARGIN = '0px 0px 1200px 0px';

export interface FeedSentinelProps {
  onNear: () => void;
}

/** An invisible marker below a feed; `onNear` fires when it comes within two rows of the viewport. */
export function FeedSentinel({ onNear }: FeedSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);

  const near = useEffectEvent(() => onNear());

  useEffect(() => {
    const target = ref.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]: IntersectionObserverEntry[]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        near();
      },
      { rootMargin: PREFETCH_MARGIN }
    );
    observer.observe(target);

    const stopObserving = () => observer.disconnect();
    return stopObserving;
  }, []);

  return <div ref={ref} aria-hidden="true" />;
}
