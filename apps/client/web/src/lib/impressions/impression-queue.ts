import { type ImpressionBatch, MAX_IMPRESSIONS_PER_BATCH } from '@vp/api-contracts';

export type Impression = ImpressionBatch['items'][number];

/** How long an impression waits for others to share its beacon. */
const FLUSH_AFTER_MS = 5000;

export interface ImpressionQueue {
  /** Counts a card's variant once per page view, however often the card mounts or scrolls back. */
  record(impression: Impression): void;
  flush(): void;
  /** The page on view; a new one starts a page view in which every card counts again. */
  view(page: string): void;
}

/** Batches impressions into beacons as full as `recordImpressions` takes, sent when full, after five seconds, or on `flush`. */
export function createImpressionQueue(send: (batch: ImpressionBatch) => void): ImpressionQueue {
  let page: string | undefined;
  let counted = new Set<string>();
  let queued: Impression[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (queued.length === 0) return;
    send({ items: queued });
    queued = [];
  };

  return {
    record(impression) {
      const key = `${impression.videoId}:${impression.experimentId}:${impression.variantId}`;
      if (counted.has(key)) return;
      counted.add(key);
      queued.push(impression);
      if (queued.length === MAX_IMPRESSIONS_PER_BATCH) flush();
      else timer ??= setTimeout(flush, FLUSH_AFTER_MS);
    },
    flush,
    view(next) {
      if (next === page) return;
      page = next;
      counted = new Set();
    },
  };
}
