import {
  MAX_WEB_VITALS_PER_BATCH,
  type TelemetryApp,
  type WebVital,
  type WebVitalsBatch,
} from '@vp/api-contracts';

export interface VitalsQueue {
  add(vital: WebVital): void;
  flush(): void;
}

export function createVitalsQueue(
  app: TelemetryApp,
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
      if (queued.length === MAX_WEB_VITALS_PER_BATCH) {
        flush();
      }
    },
    flush,
  };
}
