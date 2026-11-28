import type { Attempt, AutoscalerOptions } from '../../runner';

type Fetcher = AutoscalerOptions['fetcher'];

expectTypeOf<ReturnType<Fetcher>>().toEqualTypeOf<Promise<Attempt<string>>>();

declare const attempt: Attempt<number>;

if (attempt.type === 'done') {
  expectTypeOf(attempt.value).toEqualTypeOf<number>();
} else {
  expectTypeOf(attempt.reason).toEqualTypeOf<string>();
}

// @ts-expect-error a failed attempt carries a reason, not a value
const _failed: Attempt<number> = { type: 'failed', value: 1 };
