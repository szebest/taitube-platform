import { SpanKind, SpanStatusCode, type Tracer, context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import type { QueueJob } from '@vp/core/ports';
import type { MediaTools } from '@vp/ffmpeg';
import { CANONICAL_LADDER, type NotifyJob, type ProbeJob } from '@vp/job-contracts';
import { getActiveTraceparent } from '@vp/observability';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import { uuidv7 } from 'uuidv7';
import { createPackageProcessor } from '../stages/package';
import { createProbeProcessor } from '../stages/probe';
import { createThumbnailProcessor } from '../stages/thumbnail';
import { createTranscodeProcessor } from '../stages/transcode';
import { withTelemetry } from '../with-telemetry';
import {
  type FlowWorld,
  completionOf,
  encodeSegments,
  flowWorld,
  probed,
  writeThumbnails,
} from './flow-harness';
import { STAGE_SETTINGS, transcodeDeps } from './stage-settings';

function endFfmpegSpan(tracer: Tracer, attributes: Record<string, string | number>): void {
  const span = tracer.startSpan('ffmpeg', {
    kind: SpanKind.INTERNAL,
    attributes: { 'ffmpeg.exit_code': 0, ...attributes },
  });
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

function tracedMedia(tracer: Tracer): MediaTools {
  return {
    probe: async () =>
      probed({ width: 1920, height: 1080, durationMs: 60_000 }, [...CANONICAL_LADDER]),
    transcode: async (opts) => {
      endFfmpegSpan(tracer, {
        'ffmpeg.stage': 'transcode',
        'ffmpeg.rendition': opts.rendition.name,
        'ffmpeg.command': `ffmpeg -y -i ${opts.sourcePath} output.m3u8`,
        'ffmpeg.duration_ms': 1200,
      });
      return encodeSegments(opts, 3, 1000);
    },
    thumbnail: async (opts) => {
      endFfmpegSpan(tracer, {
        'ffmpeg.stage': 'thumbnail',
        'ffmpeg.command': 'ffmpeg -y -ss 00:00:01 -i mock.mp4 poster.jpg',
        'ffmpeg.duration_ms': 150,
      });
      return writeThumbnails(opts);
    },
  };
}

describe('withTelemetry across the pipeline', () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;
  let world: FlowWorld;

  beforeEach(() => {
    trace.disable();
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
    trace.setGlobalTracerProvider(provider);
    world = flowWorld();
  });

  it('keeps one trace from upload complete through probe, transcodes, thumbnail, package and notify', async () => {
    const { repositories, storage, getQueue } = world;
    const videoId = uuidv7();
    const sourceKey = 'raw/s60.mp4';
    await repositories.videos.create({
      id: videoId,
      ownerId: SEEDED.userId,
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

    const tracer = provider.getTracer('vp-api');
    const apiSpan = tracer.startSpan('POST /uploads/:id/complete', {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': 'POST',
        'http.route': '/uploads/:id/complete',
        'video.id': videoId,
      },
    });
    let apiTraceId = '';
    await context.with(trace.setSpan(context.active(), apiSpan), async () => {
      const traceparent = getActiveTraceparent();
      const traceId = traceparent?.split('-')[1];
      if (!(traceId && traceparent)) throw new Error('Trace context not initialized');
      apiTraceId = traceId;
      await repositories.videos.transition({
        videoId,
        from: 'UPLOADING',
        to: 'UPLOADED',
        eventType: 'upload.completed',
        traceId,
      });
      await getQueue('probe').add(
        'probe',
        { videoId, sourceKey, generation: 1, sourceSizeBytes: 10_000_000, traceparent },
        { jobId: `${videoId}--probe--g1` }
      );
      apiSpan.setStatus({ code: SpanStatusCode.OK });
      apiSpan.end();
    });

    const media = tracedMedia(tracer);
    const deps = { ...STAGE_SETTINGS, ...world, media };
    const [probeJob] = expectOk(await getQueue('probe').getJobs(['waiting']));
    if (!probeJob) throw new Error('probe job missing');
    await withTelemetry(
      'probe',
      createProbeProcessor(deps)
    )({
      id: probeJob.id,
      name: 'probe',
      data: probeJob.data as ProbeJob,
      attemptsMade: 1,
    });

    const packageQueue = getQueue('package');
    const packaged = completionOf(packageQueue, `${videoId}--package--g1`);
    await packageQueue.process(withTelemetry('package', createPackageProcessor(deps)));
    const transcode = createTranscodeProcessor(transcodeDeps({ ...world, media }));
    for (const rung of ['1080p', '720p', '480p']) {
      await getQueue(`transcode-${rung}`).process(withTelemetry(`transcode-${rung}`, transcode));
    }
    await getQueue('thumbnail').process(withTelemetry('thumbnail', createThumbnailProcessor(deps)));
    await packaged;

    expect(expectOk(await packageQueue.getJobState(`${videoId}--package--g1`))).toBe('completed');
    const [notifyJob] = expectOk(await getQueue('notify').getJobs(['waiting']));
    if (!notifyJob) throw new Error('notify job missing');
    const notify = withTelemetry('notify', async (_job: QueueJob<NotifyJob>) => ({ sent: true }));
    await notify({
      id: notifyJob.id,
      name: 'notify',
      data: notifyJob.data as NotifyJob,
      attemptsMade: 1,
    });

    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBeGreaterThanOrEqual(8);
    expect(apiTraceId).not.toBe('');
    for (const span of spans) {
      expect(span.spanContext().traceId).toBe(apiTraceId);
    }
    const probeSpan = spans.find((s) => s.name === 'bullmq.process probe');
    expect(probeSpan?.attributes['job.id']).toBeDefined();
    expect(probeSpan?.attributes.videoId).toBe(videoId);
    expect(probeSpan?.attributes.queue).toBe('probe');
    expect(probeSpan?.parentSpanContext?.spanId).toBe(apiSpan.spanContext().spanId);
    const ffmpegSpans = spans.filter((s) => s.name === 'ffmpeg');
    expect(ffmpegSpans.length).toBeGreaterThanOrEqual(4);
    for (const span of ffmpegSpans) {
      expect(span.attributes['ffmpeg.exit_code']).toBe(0);
      expect(span.attributes['ffmpeg.command']).toBeDefined();
      expect(span.attributes['ffmpeg.duration_ms']).toBeDefined();
    }
    const events = expectOk(await repositories.events.findByVideoId(videoId));
    expect(events.find((e) => e.type === 'upload.completed')?.traceId).toBe(apiTraceId);
  });
});
