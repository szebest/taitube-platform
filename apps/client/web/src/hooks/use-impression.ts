import type { VideoSummary } from '@vp/api-contracts';
import { type RefObject, useEffect, useRef } from 'react';
import { useRecordImpression } from '#app/integrations/impressions/impressions-provider';

/** Half the card on screen is a card seen. */
const IN_VIEW_THRESHOLD = 0.5;

/**
 * The ref for a card showing `video`: when its summary carries a test variant, the card counts one
 * impression of it the first time it comes into view.
 */
export function useImpression(
  video: Pick<VideoSummary, 'id' | 'experiment'>
): RefObject<HTMLElement | null> {
  const card = useRef<HTMLElement>(null);
  const record = useRecordImpression();
  const videoId = video.id;
  const experimentId = video.experiment?.id;
  const variantId = video.experiment?.variantId;

  useEffect(() => {
    const node = card.current;
    if (!node || !record || experimentId === undefined || variantId === undefined) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        record({ videoId, experimentId, variantId });
        observer.disconnect();
      },
      { threshold: IN_VIEW_THRESHOLD }
    );
    observer.observe(node);

    const stopObserving = () => observer.disconnect();
    return stopObserving;
  }, [record, videoId, experimentId, variantId]);

  return card;
}
