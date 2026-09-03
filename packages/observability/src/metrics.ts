import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export interface PipelineMetrics {
  registry: Registry;

  // HTTP Metrics (API)
  httpRequestDuration: Histogram<string>;
  httpRequestsInFlight: Gauge<string>;

  // SSE Metrics
  sseConnections: Gauge<string>;
  sseEventsPublished: Counter<string>;

  // BullMQ Queue & Worker Metrics
  bullmqQueueJobs: Gauge<string>;
  bullmqQueueOldestWaitingAge: Gauge<string>;
  jobsProcessed: Counter<string>;
  jobDuration: Histogram<string>;
  jobWaitDuration: Histogram<string>;

  // Transcoding & FFmpeg Metrics
  transcodeRealtimeFactor: Histogram<string>;
  transcodeOutputBytes: Counter<string>;
  ffmpegExitTotal: Counter<string>;

  // Storage & System Metrics
  storageOpsTotal: Counter<string>;
  storageOpDuration: Histogram<string>;
  workerTmpBytes: Gauge<string>;
  dlqEntriesTotal: Counter<string>;
  videosByStatus: Gauge<string>;
  timeToReady: Histogram<string>;
}

export function createMetricsRegistry(defaultLabels: Record<string, string> = {}): PipelineMetrics {
  const registry = new Registry();
  registry.setDefaultLabels(defaultLabels);
  collectDefaultMetrics({ register: registry });

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

  const timeToReady = new Histogram({
    name: 'time_to_ready_seconds',
    help: 'Total time from upload complete to video ready status',
    labelNames: ['bucket'],
    buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800],
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
    timeToReady,
  };
}

let defaultMetricsInstance: PipelineMetrics | null = null;

export function getMetrics(): PipelineMetrics {
  if (!defaultMetricsInstance) {
    defaultMetricsInstance = createMetricsRegistry();
  }
  return defaultMetricsInstance;
}
