import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  InMemoryFlowProducer,
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type { QueueJob } from '@vp/core/ports';
import type { NotifyJob, ProbeJob } from '@vp/job-contracts';
import { getActiveSpanContext } from '@vp/observability';
import { createLogger } from '@vp/logger';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createThumbnailProcessor } from '../stages/thumbnail';
import { createTranscodeProcessor } from '../stages/transcode';
import { withTelemetry } from '../with-telemetry';
import { STAGE_SETTINGS, transcodeDeps } from './stage-settings';

describe('OpenTelemetry Tracing End-to-End (Ticket 23: AC 17, 18, 19, 20, 21)', () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;
  let repositories: InMemoryRepositories;
  let storage: InMemoryStorageClient;
  let queues: Map<string, InMemoryJobQueue>;
  let flowProducer: InMemoryFlowProducer;
  const DEV_USER_ID = '00000000-0000-7000-8000-000000000001';
  const logger = createLogger({ format: 'json', service: 'tracing-e2e-test', level: 'silent' });

  function getQueue(name: string): InMemoryJobQueue {
    let q = queues.get(name);
    if (!q) {
      q = new InMemoryJobQueue(name);
      queues.set(name, q);
    }
    return q;
  }

  beforeEach(() => {
    trace.disable();
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    const contextManager = new AsyncLocalStorageContextManager().enable();
    context.setGlobalContextManager(contextManager);
    trace.setGlobalTracerProvider(provider);

    repositories = new InMemoryRepositories();
    storage = new InMemoryStorageClient();
    queues = new Map();
    flowProducer = new InMemoryFlowProducer(getQueue);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates one trace from upload complete through probe, 3 transcodes (with ffmpeg child spans), thumbnail, package, and notify', async () => {
    const videoId = uuidv7();
    const sourceKey = 'raw/s60.mp4';

    await repositories.videos.create({
      id: videoId,
      ownerId: DEV_USER_ID,
      title: 's60 E2E Traced Video',
      status: 'UPLOADING',
      sourceKey,
      sourceSizeBytes: 10_000_000,
    });

    await storage.uploadObject({
      bucket: 'raw',
      key: sourceKey,
      body: Buffer.from('mock-video-bytes'),
      contentType: 'video/mp4',
    });

    // 1. Simulate POST /uploads/:id/complete producer span
    const tracer = provider.getTracer('vp-api');
    const apiSpan = tracer.startSpan('POST /uploads/:id/complete', {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': 'POST',
        'http.route': '/uploads/:id/complete',
        'video.id': videoId,
      },
    });

    let apiTraceparent = '';
    let apiTraceId = '';

    await context.with(trace.setSpan(context.active(), apiSpan), async () => {
      const activeCtx = getActiveSpanContext();
      if (!(activeCtx.traceId && activeCtx.traceparent)) {
        throw new Error('Trace context not initialized');
      }
      apiTraceId = activeCtx.traceId;
      apiTraceparent = activeCtx.traceparent;

      // CAS transition upload.completed with traceId (UPLOADING -> UPLOADED per SDD §5.2)
      await repositories.videos.transition({
        videoId,
        from: 'UPLOADING',
        to: 'UPLOADED',
        eventType: 'upload.completed',
        traceId: apiTraceId,
      });

      // Enqueue probe job carrying traceparent
      const probeQueue = getQueue('probe');
      await probeQueue.add(
        'probe',
        {
          videoId,
          sourceKey,
          generation: 1,
          sourceSizeBytes: 10_000_000,
          traceparent: apiTraceparent,
        },
        { jobId: `${videoId}--probe--g1` }
      );

      apiSpan.setStatus({ code: SpanStatusCode.OK });
      apiSpan.end();
    });

    // Mock ffmpeg functions with spans
    const ffmpegModule = await import('@vp/ffmpeg');
    const { CANONICAL_LADDER } = await import('@vp/ffmpeg');
    vi.spyOn(ffmpegModule, 'runFfprobe').mockResolvedValue({
      durationMs: 60_000,
      width: 1920,
      height: 1080,
      effectiveWidth: 1920,
      effectiveHeight: 1080,
      rotation: 0,
      fps: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
      bitrateKbps: 2500,
      ladder: [...CANONICAL_LADDER],
    });

    vi.spyOn(ffmpegModule, 'runFfmpegTranscode').mockImplementation(async (opts) => {
      const ffmpegSpan = tracer.startSpan('ffmpeg', {
        kind: SpanKind.INTERNAL,
        attributes: {
          'ffmpeg.stage': 'transcode',
          'ffmpeg.rendition': opts.rendition.name,
          'ffmpeg.command': `ffmpeg -y -i ${opts.sourcePath} output.m3u8`,
          'ffmpeg.exit_code': 0,
          'ffmpeg.duration_ms': 1200,
        },
      });
      ffmpegSpan.setStatus({ code: SpanStatusCode.OK });
      ffmpegSpan.end();

      // Write mock segments and index.m3u8 to opts.outputDir
      for (let i = 1; i <= 3; i++) {
        await fs.writeFile(
          path.join(opts.outputDir, `seg_${String(i).padStart(5, '0')}.ts`),
          Buffer.alloc(1000)
        );
      }
      await fs.writeFile(
        path.join(opts.outputDir, 'index.m3u8'),
        '#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:6\n#EXTINF:6.0,\nseg_00001.ts\n#EXT-X-ENDLIST\n'
      );

      return {
        outputDir: opts.outputDir,
        playlistPath: path.join(opts.outputDir, 'index.m3u8'),
        segmentCount: 3,
        durationMs: 1200,
      } as unknown as {
        outputDir: string;
        playlistPath: string;
        segmentCount: number;
        durationMs: number;
      };
    });

    vi.spyOn(ffmpegModule, 'runFfmpegThumbnail').mockImplementation(async (opts) => {
      const ffmpegSpan = tracer.startSpan('ffmpeg', {
        kind: SpanKind.INTERNAL,
        attributes: {
          'ffmpeg.stage': 'thumbnail',
          'ffmpeg.command': 'ffmpeg -y -ss 00:00:01 -i mock.mp4 poster.jpg',
          'ffmpeg.exit_code': 0,
          'ffmpeg.duration_ms': 150,
        },
      });
      ffmpegSpan.setStatus({ code: SpanStatusCode.OK });
      ffmpegSpan.end();

      await fs.writeFile(path.join(opts.outputDir, 'poster.jpg'), Buffer.alloc(100));
      await fs.writeFile(path.join(opts.outputDir, 'sprite.jpg'), Buffer.alloc(100));
      await fs.writeFile(path.join(opts.outputDir, 'sprite.vtt'), 'WEBVTT\n');

      return {
        outputDir: opts.outputDir,
        posterPath: path.join(opts.outputDir, 'poster.jpg'),
        spritePath: path.join(opts.outputDir, 'sprite.jpg'),
        vttPath: path.join(opts.outputDir, 'sprite.vtt'),
        frameCount: 12,
        rows: 2,
        columns: 6,
      };
    });

    // 2. Worker runs probe wrapped with withTelemetry
    const rawProbeProcessor = createProbeProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      flowProducer,
      getQueue,
      logger,
    });
    const tracedProbeProcessor = withTelemetry('probe', rawProbeProcessor);

    const probeQueue = getQueue('probe');
    const [probeQueueJob] = expectOk(await probeQueue.getJobs(['waiting']));
    expect(probeQueueJob).toBeDefined();
    if (!probeQueueJob) throw new Error('probeQueueJob missing');

    await tracedProbeProcessor({
      id: probeQueueJob.id,
      data: probeQueueJob.data as ProbeJob,
      attemptsMade: 1,
    } as QueueJob<ProbeJob>);

    // 3. Register package stage processor
    const packageQueue = getQueue('package');
    const rawPackageProcessor = createPackageProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      getQueue,
      logger,
    });
    const tracedPackageProcessor = withTelemetry('package', rawPackageProcessor);
    await packageQueue.process(tracedPackageProcessor);

    // 4. Worker processes transcode children (1080p, 720p, 480p)
    const rawTranscodeProcessor = createTranscodeProcessor(
      transcodeDeps({ repositories, storage, logger })
    );

    const transcodeRenditions = ['1080p', '720p', '480p'];
    for (const rend of transcodeRenditions) {
      const q = getQueue(`transcode-${rend}`);
      const tracedTranscode = withTelemetry(`transcode-${rend}`, rawTranscodeProcessor);
      await q.process(tracedTranscode);
    }

    // 5. Worker processes thumbnail child
    const thumbQueue = getQueue('thumbnail');
    const rawThumbProcessor = createThumbnailProcessor({
      ...STAGE_SETTINGS,
      repositories,
      storage,
      logger,
    });
    const tracedThumbProcessor = withTelemetry('thumbnail', rawThumbProcessor);
    await thumbQueue.process(tracedThumbProcessor);

    // Allow microtasks to settle for flow completion of package
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check package status
    const packageJobId = `${videoId}--package--g1`;
    const packageState = expectOk(await packageQueue.getJobState(packageJobId));
    expect(packageState).toBe('completed');

    // 6. Worker runs notify stage
    const notifyQueue = getQueue('notify');
    const [notifyJob] = expectOk(await notifyQueue.getJobs(['waiting']));
    expect(notifyJob).toBeDefined();
    if (!notifyJob) throw new Error('notifyJob missing');

    const tracedNotifyProcessor = withTelemetry('notify', async (_job: QueueJob<NotifyJob>) => {
      // Simulate notify handler
      return { sent: true };
    });
    await tracedNotifyProcessor({
      id: notifyJob.id,
      data: notifyJob.data as NotifyJob,
      attemptsMade: 1,
    } as QueueJob<NotifyJob>);

    // 7. Verify Spans and Assertions
    const finishedSpans = exporter.getFinishedSpans();

    // Verify span count: >= 8 spans across >= 4 services
    // Spans expected:
    // 1. POST /uploads/:id/complete (vp-api)
    // 2. bullmq.process probe
    // 3. bullmq.process transcode-1080p
    // 4. ffmpeg (transcode 1080p child)
    // 5. bullmq.process transcode-720p
    // 6. ffmpeg (transcode 720p child)
    // 7. bullmq.process transcode-480p
    // 8. ffmpeg (transcode 480p child)
    // 9. bullmq.process thumbnail
    // 10. ffmpeg (thumbnail child)
    if (finishedSpans.length < 8) {
      console.log(
        'Finished spans in test:',
        finishedSpans.map((s) => s.name)
      );
    }
    expect(finishedSpans.length).toBeGreaterThanOrEqual(8);

    // All spans must share the exact same traceId
    const rootTraceId = apiTraceId;
    expect(rootTraceId).toBeDefined();
    for (const s of finishedSpans) {
      expect(s.spanContext().traceId).toBe(rootTraceId);
    }

    // Verify bullmq.process probe is a child of POST /uploads/:id/complete
    const probeSpan = finishedSpans.find((s) => s.name === 'bullmq.process probe');
    expect(probeSpan).toBeDefined();
    expect(probeSpan?.attributes['job.id']).toBeDefined();
    expect(probeSpan?.attributes.videoId).toBe(videoId);
    expect(probeSpan?.attributes.queue).toBe('probe');
    expect(probeSpan?.parentSpanContext?.spanId).toBe(apiSpan.spanContext().spanId);

    // Verify ffmpeg spans
    const ffmpegSpans = finishedSpans.filter((s) => s.name === 'ffmpeg');
    expect(ffmpegSpans.length).toBeGreaterThanOrEqual(4);
    for (const ffSpan of ffmpegSpans) {
      expect(ffSpan.attributes['ffmpeg.exit_code']).toBe(0);
      expect(ffSpan.attributes['ffmpeg.command']).toBeDefined();
      expect(ffSpan.attributes['ffmpeg.duration_ms']).toBeDefined();
    }

    // Verify database events correlation: video_events has trace_id
    const events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.length).toBeGreaterThanOrEqual(1);
    const completedEvent = events.find((e) => e.type === 'upload.completed');
    expect(completedEvent).toBeDefined();
    expect(completedEvent?.traceId).toBe(rootTraceId);
  });
});
