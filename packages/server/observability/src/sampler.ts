import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
  type Sampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { assertNever } from '@vp/result';

export type TraceSamplerName =
  | 'always_on'
  | 'always_off'
  | 'traceidratio'
  | 'parentbased_always_on'
  | 'parentbased_always_off'
  | 'parentbased_traceidratio';

/** The sampler a name selects; `ratio` is `OTEL_TRACES_SAMPLER_ARG`, read by the ratio samplers. */
export function resolveSampler(name: TraceSamplerName, ratio: number): Sampler {
  switch (name) {
    case 'always_on':
      return new AlwaysOnSampler();
    case 'always_off':
      return new AlwaysOffSampler();
    case 'traceidratio':
      return new TraceIdRatioBasedSampler(ratio);
    case 'parentbased_always_on':
      return new ParentBasedSampler({ root: new AlwaysOnSampler() });
    case 'parentbased_always_off':
      return new ParentBasedSampler({ root: new AlwaysOffSampler() });
    case 'parentbased_traceidratio':
      return new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(ratio) });
    default:
      return assertNever(name, 'OTEL_TRACES_SAMPLER');
  }
}
