import {
  ROOT_CONTEXT,
  type Span,
  SpanKind,
  type SpanStatus,
  SpanStatusCode,
  context,
  trace,
} from '@opentelemetry/api';
import { extractContextFromTraceparent, getTracer } from '@vp/observability';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { routeLabel } from './route-label';

const SERVER_ERROR = 500;

function endSpan(
  spans: WeakMap<FastifyRequest, Span>,
  request: FastifyRequest,
  status: SpanStatus,
  statusCode?: number
) {
  const span = spans.get(request);
  if (!span) return;
  if (statusCode !== undefined) span.setAttribute('http.response.status_code', statusCode);
  span.setStatus(status);
  span.end();
  spans.delete(request);
}

/**
 * The API's HTTP server span, named by route and parented on the caller's `traceparent`. The
 * request runs inside it, so whatever the handler enqueues carries this trace (SDD §13.3).
 */
async function requestSpanPlugin(app: FastifyInstance) {
  const spans = new WeakMap<FastifyRequest, Span>();

  app.addHook('onRequest', (request, _reply, done) => {
    const traceparent = request.headers.traceparent;
    // The HTTP instrumentation runs an incoming request it ignores with tracing suppressed.
    const parent = extractContextFromTraceparent(
      typeof traceparent === 'string' ? traceparent : undefined,
      ROOT_CONTEXT
    );
    const route = routeLabel(request);
    const span = getTracer().startSpan(
      `${request.method} ${route}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.request.method': request.method,
          'http.route': route,
          'vp.request_id': request.id,
        },
      },
      parent
    );
    spans.set(request, span);
    context.with(trace.setSpan(parent, span), done);
  });

  app.addHook('onResponse', async (request, reply) => {
    const code = reply.statusCode >= SERVER_ERROR ? SpanStatusCode.ERROR : SpanStatusCode.UNSET;
    endSpan(spans, request, { code }, reply.statusCode);
  });

  app.addHook('onRequestAbort', async (request) => {
    endSpan(spans, request, { code: SpanStatusCode.ERROR, message: 'client aborted' });
  });
}

export const registerRequestSpan = fp(requestSpanPlugin, {
  name: 'vp-request-span',
  fastify: '5.x',
});
