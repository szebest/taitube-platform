import { extractContextFromTraceparent, getTracer } from '@kit/observability';
import type { QueueJob } from '@kit/ports';
import { fromPromise } from '@kit/result';
import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { TRACER_NAME } from '@vp/pipeline-metrics';

/**
 * Runs a processor inside a `bullmq.process {queue}` span, a child of the producer's `traceparent`
 * (SDD §13.3). A processor that throws is recorded on the span and rethrown for BullMQ.
 */
export function withTelemetry<TData extends { videoId?: string; traceparent?: string }, TResult>(
  queue: string,
  processor: (job: QueueJob<TData>) => Promise<TResult>
): (job: QueueJob<TData>) => Promise<TResult> {
  return async (job: QueueJob<TData>): Promise<TResult> => {
    const tracer = getTracer(TRACER_NAME);
    const traceparent = job.data?.traceparent;
    const parentContext = extractContextFromTraceparent(traceparent);

    const spanName = `bullmq.process ${queue}`;
    const span = tracer.startSpan(
      spanName,
      {
        kind: SpanKind.CONSUMER,
        attributes: {
          'job.id': job.id || '',
          attemptsMade: job.attemptsMade ?? 0,
          videoId: job.data?.videoId || '',
          queue,
        },
      },
      parentContext
    );

    return context.with(trace.setSpan(parentContext, span), async () => {
      const settled = await fromPromise(
        () => processor(job),
        (cause) => cause
      );
      if (settled.ok) {
        span.setStatus({ code: SpanStatusCode.OK });
      } else {
        const error = settled.error as Error;
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      }
      span.end();

      if (!settled.ok) throw settled.error;
      return settled.value;
    });
  };
}
