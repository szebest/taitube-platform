export interface WebVital {
  name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB' | 'LONG_TASKS';
  value: number;
  route: string;
  source?: string;
}

export interface WebVitalsBatch {
  app: string;
  vitals: WebVital[];
}

export interface VitalsQueue {
  add(vital: WebVital): void;
  flush(): void;
}

export function createVitalsQueue(
  app: string,
  maxBatchSize: number,
  send: (batch: WebVitalsBatch) => void
): VitalsQueue {
  let queued: WebVital[] = [];

  const flush = () => {
    if (queued.length === 0) {
      return;
    }

    send({ app, vitals: queued });
    queued = [];
  };

  return {
    add(vital) {
      queued.push(vital);
      if (queued.length === maxBatchSize) {
        flush();
      }
    },
    flush,
  };
}
