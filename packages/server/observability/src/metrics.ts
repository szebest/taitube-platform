import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export interface PipelineMetrics {
  registry: Registry;

  httpRequestDuration: Histogram<string>;
  httpRequestsInFlight: Gauge<string>;

  sseConnections: Gauge<string>;
  sseEventsPublished: Counter<string>;

  bullmqQueueJobs: Gauge<string>;
  bullmqQueueOldestWaitingAge: Gauge<string>;
  jobsProcessed: Counter<string>;
  jobDuration: Histogram<string>;
  jobWaitDuration: Histogram<string>;

  transcodeRealtimeFactor: Histogram<string>;
  transcodeOutputBytes: Counter<string>;
  ffmpegExitTotal: Counter<string>;

  storageOpsTotal: Counter<string>;
  storageOpDuration: Histogram<string>;
  workerTmpBytes: Gauge<string>;
  dlqEntriesTotal: Counter<string>;
  videosByStatus: Gauge<string>;
  processingStepsRunningStale: Gauge<string>;
  timeToReady: Histogram<string>;
  reconcilerRepairsTotal: Counter<string>;
  outboxDrainDuration: Histogram<string>;
  outboxEventsPublished: Counter<string>;
  viewsRecorded: Counter<string>;
  viewBufferCircuitOpen: Gauge<string>;
  viewsFlushed: Counter<string>;
  viewFlushDuration: Histogram<string>;
}

/** Every process metric carries this, so a scrape of any deployable names each series once. */
const PROCESS_METRICS_PREFIX = 'vp_';

/** One per process, built by its composition root and handed to everything that records. */
export function createMetricsRegistry(): PipelineMetrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: PROCESS_METRICS_PREFIX });

  const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const httpRequestsInFlight = new Gauge({
    name: 'http_requests_in_flight',
    help: 'Current number of active HTTP requests',
    registers: [registry],
  });

  const sseConnections = new Gauge({
    name: 'sse_connections',
    help: 'Current number of active SSE client connections',
    labelNames: ['channel_type'],
    registers: [registry],
  });

  const sseEventsPublished = new Counter({
    name: 'sse_events_published_total',
    help: 'Total count of SSE events published to Redis pub/sub',
    labelNames: ['event'],
    registers: [registry],
  });

  const bullmqQueueJobs = new Gauge({
    name: 'bullmq_queue_jobs',
    help: 'Number of jobs in queue by state',
    labelNames: ['queue', 'state'],
    registers: [registry],
  });

  const bullmqQueueOldestWaitingAge = new Gauge({
    name: 'bullmq_queue_oldest_waiting_age_seconds',
    help: 'Age of oldest waiting job in queue in seconds',
    labelNames: ['queue'],
    registers: [registry],
  });

  const jobsProcessed = new Counter({
    name: 'jobs_processed_total',
    help: 'Total jobs processed by workers',
    labelNames: ['queue', 'result'],
    registers: [registry],
  });

  const jobDuration = new Histogram({
    name: 'job_duration_seconds',
    help: 'Worker job duration in seconds',
    labelNames: ['queue'],
    buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600, 1800],
    registers: [registry],
  });

  const jobWaitDuration = new Histogram({
    name: 'job_wait_seconds',
    help: 'Time job spent waiting in queue before processing in seconds',
    labelNames: ['queue'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 15, 30, 60, 120],
    registers: [registry],
  });

  const transcodeRealtimeFactor = new Histogram({
    name: 'transcode_realtime_factor',
    help: 'Transcode speed ratio (video duration / encoding duration)',
    labelNames: ['rendition', 'preset'],
    buckets: [0.2, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0, 5.0, 10.0],
    registers: [registry],
  });

  const transcodeOutputBytes = new Counter({
    name: 'transcode_output_bytes_total',
    help: 'Total bytes of transcoded media produced',
    labelNames: ['rendition'],
    registers: [registry],
  });

  const ffmpegExitTotal = new Counter({
    name: 'ffmpeg_exit_total',
    help: 'Total FFmpeg process exits by stage and exit code',
    labelNames: ['stage', 'code'],
    registers: [registry],
  });

  const storageOpsTotal = new Counter({
    name: 'storage_ops_total',
    help: 'Total S3 object storage operations',
    labelNames: ['op', 'bucket', 'result'],
    registers: [registry],
  });

  const storageOpDuration = new Histogram({
    name: 'storage_op_duration_seconds',
    help: 'S3 object storage operation duration in seconds',
    labelNames: ['op', 'bucket', 'result'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  const workerTmpBytes = new Gauge({
    name: 'worker_tmp_bytes',
    help: 'Current temporary disk space used by worker in bytes',
    labelNames: ['stage'],
    registers: [registry],
  });

  const dlqEntriesTotal = new Counter({
    name: 'dlq_entries_total',
    help: 'Total jobs routed to Dead Letter Queue',
    labelNames: ['queue', 'error_code'],
    registers: [registry],
  });

  const videosByStatus = new Gauge({
    name: 'videos_by_status',
    help: 'Current video counts grouped by status in PostgreSQL',
    labelNames: ['status'],
    registers: [registry],
  });

  const processingStepsRunningStale = new Gauge({
    name: 'processing_steps_running_stale',
    help: 'Number of RUNNING processing steps with stale heartbeats (> 5 min)',
    registers: [registry],
  });

  const timeToReady = new Histogram({
    name: 'time_to_ready_seconds',
    help: 'Total time from upload complete to video ready status',
    labelNames: ['bucket'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800],
    registers: [registry],
  });

  const reconcilerRepairsTotal = new Counter({
    name: 'reconciler_repairs_total',
    help: 'Total number of stuck or lost jobs repaired by the reconciler',
    labelNames: ['type'],
    registers: [registry],
  });

  const outboxDrainDuration = new Histogram({
    name: 'outbox_drain_duration_seconds',
    help: 'Time taken to drain an outbox batch to BullMQ in seconds',
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [registry],
  });

  const outboxEventsPublished = new Counter({
    name: 'outbox_events_published_total',
    help: 'Total number of outbox records published to queues',
    labelNames: ['kind'],
    registers: [registry],
  });

  const viewsRecorded = new Counter({
    name: 'video_views_recorded_total',
    help: 'Playback beacons received, by what became of them',
    labelNames: ['outcome'],
    registers: [registry],
  });

  const viewBufferCircuitOpen = new Gauge({
    name: 'video_view_buffer_circuit_open',
    help: '1 while the view buffer is bypassed for the in-process fallback, 0 otherwise',
    registers: [registry],
  });

  const viewsFlushed = new Counter({
    name: 'video_views_flushed_total',
    help: 'Views moved from the Redis buffer into PostgreSQL',
    registers: [registry],
  });

  const viewFlushDuration = new Histogram({
    name: 'video_view_flush_duration_seconds',
    help: 'Time taken to drain the view buffer into PostgreSQL in seconds',
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  return {
    registry,
    httpRequestDuration,
    httpRequestsInFlight,
    sseConnections,
    sseEventsPublished,
    bullmqQueueJobs,
    bullmqQueueOldestWaitingAge,
    jobsProcessed,
    jobDuration,
    jobWaitDuration,
    transcodeRealtimeFactor,
    transcodeOutputBytes,
    ffmpegExitTotal,
    storageOpsTotal,
    storageOpDuration,
    workerTmpBytes,
    dlqEntriesTotal,
    videosByStatus,
    processingStepsRunningStale,
    timeToReady,
    reconcilerRepairsTotal,
    outboxDrainDuration,
    outboxEventsPublished,
    viewsRecorded,
    viewBufferCircuitOpen,
    viewsFlushed,
    viewFlushDuration,
  };
}
