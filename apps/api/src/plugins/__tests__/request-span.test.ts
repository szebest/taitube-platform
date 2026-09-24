import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { suppressTracing } from '@opentelemetry/core';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import type { ProbeJob } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { composeApp } from '../../app';
import { abortMidRequest } from './abort-mid-request';

const OWNER_ID = '0190a000-0000-7000-8000-0000000000d1';
const CALLER_TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

function exportSpans(): InMemorySpanExporter {
  const exporter = new InMemorySpanExporter();
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
  );
  return exporter;
}

async function completeAnUpload(headers: Record<string, string>) {
  const repositories = new InMemoryRepositories();
  const storage = new InMemoryStorageClient();
  const probeQueue = new InMemoryJobQueue('probe');
  const { app } = await composeApp({
    config: inProcessAppConfig({ buckets: { raw: 'raw' } }),
    adapters: { repositories, storage, probeQueue },
  });
  const authorization = `Bearer ${mintToken({ sub: OWNER_ID, role: 'user', ttl: '1h' })}`;

  const started = await app.inject({
    method: 'POST',
    url: '/v1/uploads',
    headers: { authorization },
    payload: { filename: 'a.mp4', sizeBytes: 1024, contentType: 'video/mp4', title: 'a' },
  });
  const { uploadId, videoId } = started.json<{ uploadId: string; videoId: string }>();
  const video = expectOk(await repositories.videos.findById(videoId));
  expectOk(
    await storage.uploadObject({
      bucket: 'raw',
      key: video?.sourceKey ?? '',
      body: Buffer.alloc(1024),
      contentType: 'video/mp4',
    })
  );

  await app.inject({
    method: 'POST',
    url: `/v1/uploads/${uploadId}/complete`,
    headers: { authorization, ...headers },
    payload: {},
  });
  await app.close();

  const [job] = expectOk(await probeQueue.getJobs(['waiting']));
  return job?.data as ProbeJob;
}

describe('apps/api/plugins: request span', () => {
  afterEach(() => {
    trace.disable();
    context.disable();
  });

  it('exports one server span per request, and the job it enqueued carries its trace', async () => {
    const exporter = exportSpans();

    const job = await completeAnUpload({});

    const [complete] = exporter
      .getFinishedSpans()
      .filter((span) => span.name === 'POST /v1/uploads/:uploadId/complete');
    expect(complete?.kind).toBe(SpanKind.SERVER);
    expect(complete?.attributes['http.response.status_code']).toBe(202);
    expect(job.traceparent.split('-')[1]).toBe(complete?.spanContext().traceId);
  });

  it('traces a request the HTTP instrumentation handed over with tracing suppressed', async () => {
    const exporter = exportSpans();

    await context.with(suppressTracing(context.active()), () => completeAnUpload({}));

    expect(exporter.getFinishedSpans().map((span) => span.name)).toContain(
      'POST /v1/uploads/:uploadId/complete'
    );
  });

  it('ends the span of a request the client hung up on, as an error', async () => {
    const exporter = exportSpans();
    const { app } = await composeApp({ config: inProcessAppConfig() });

    await abortMidRequest(app);
    await app.close();

    const hung = exporter.getFinishedSpans().filter((span) => span.name === 'GET /hang');
    expect(hung).toHaveLength(1);
    expect(hung[0]?.status).toEqual({ code: SpanStatusCode.ERROR, message: 'client aborted' });
  });

  it("continues the caller's trace when the request carries a traceparent", async () => {
    const exporter = exportSpans();

    const job = await completeAnUpload({ traceparent: CALLER_TRACEPARENT });

    const complete = exporter.getFinishedSpans().find((span) => span.name.endsWith('/complete'));
    expect(complete?.parentSpanContext?.spanId).toBe('00f067aa0ba902b7');
    expect(job.traceparent.split('-')[1]).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });
});
