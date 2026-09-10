import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import type { QueueJob } from '@vp/core/ports';
import { extractContextFromTraceparent, getTracer } from '@vp/observability';

export interface WithTelemetryOptions {
  queue: string;
}

/**
 * Wraps a worker processor with OpenTelemetry tracing and context propagation.
 * Extracts `traceparent` from `job.data`, starts span `bullmq.process {queue}`
 * as a child of the producer span with attributes `job.id`, `attemptsMade`, `videoId`, `queue`.
 * (SDD §13.3, Ticket 23 AC 17)
 */
export function withTelemetry<TData extends { videoId?: string; traceparent?: string }, TResult>(
  queue: string,
  processor: (job: QueueJob<TData>) => Promise<TResult>
): (job: QueueJob<TData>) => Promise<TResult> {
  return async (job: QueueJob<TData>): Promise<TResult> => {
    const tracer = getTracer('video-pipeline');
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
      try {
        const result = await processor(job);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err: unknown) {
        const error = err as Error;
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw err;
      } finally {
        span.end();
      }
    });
  };
}
