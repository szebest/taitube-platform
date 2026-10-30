import { ROOT_CONTEXT, SpanKind, TraceFlags, trace } from '@opentelemetry/api';
import { SamplingDecision } from '@opentelemetry/sdk-trace-base';
import { type TraceSamplerName, resolveSampler } from '../sampler';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

const SAMPLED_PARENT = trace.setSpanContext(ROOT_CONTEXT, {
  traceId: TRACE_ID,
  spanId: '00f067aa0ba902b7',
  traceFlags: TraceFlags.SAMPLED,
  isRemote: true,
});

function sampled(name: TraceSamplerName, ratio: number, parent = ROOT_CONTEXT): boolean {
  const { decision } = resolveSampler(name, ratio).shouldSample(
    parent,
    TRACE_ID,
    'request',
    SpanKind.SERVER,
    {},
    []
  );
  return decision === SamplingDecision.RECORD_AND_SAMPLED;
}

describe('@vp/observability: resolveSampler', () => {
  it.each<[TraceSamplerName, number, boolean, boolean]>([
    ['always_on', 0, true, true],
    ['always_off', 1, false, false],
    ['traceidratio', 0, false, false],
    ['traceidratio', 1, true, true],
    ['parentbased_always_on', 0, true, true],
    ['parentbased_always_off', 1, false, true],
    ['parentbased_traceidratio', 0, false, true],
    ['parentbased_traceidratio', 1, true, true],
  ])('%s at ratio %d samples a root span: %s, a sampled parent: %s', (name, ratio, root, child) => {
    expect(sampled(name, ratio)).toBe(root);
    expect(sampled(name, ratio, SAMPLED_PARENT)).toBe(child);
  });
});
