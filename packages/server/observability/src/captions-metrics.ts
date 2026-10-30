import { Counter, Histogram, type Registry } from 'prom-client';

/** Speech-to-text runs on its own queue and pods, so it is watched apart from the transcodes. */
export interface CaptionsMetrics {
  captionsRealtimeFactor: Histogram<string>;
  captionsTimeToReady: Histogram<string>;
  captionsJobsTotal: Counter<string>;
}

export function createCaptionsMetrics(registry: Registry): CaptionsMetrics {
  const captionsRealtimeFactor = new Histogram({
    name: 'captions_realtime_factor',
    help: 'Seconds of audio transcribed per second of whisper wall-clock',
    labelNames: ['model'],
    buckets: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10],
    registers: [registry],
  });

  const captionsTimeToReady = new Histogram({
    name: 'captions_time_to_ready_seconds',
    help: 'Seconds from a generated track being asked for at probe to it being ready',
    buckets: [30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 21600],
    registers: [registry],
  });

  const captionsJobsTotal = new Counter({
    name: 'captions_jobs_total',
    help: 'Generated caption tracks by how their run ended',
    labelNames: ['outcome'],
    registers: [registry],
  });

  return { captionsRealtimeFactor, captionsTimeToReady, captionsJobsTotal };
}
